/**
 * Section b's backdrop (noon; docs/design/ams2.md §3): the far city, the museum and what stands beyond it
 * on the middle plane (the white museum, the concert hall, a far row of houses), and the lawn with its
 * pools, tulip beds and trees. The numbers of the museum come from the approved scene.
 */
import { addMargin, S, text } from '../../../art/herokit/canvas';
import { range, pyMod } from '../../../art/herokit/canvas-math';
import { grass } from '../../../art/herokit/floors';
import { crown, hedge, swayCrown, trunk } from '../../../art/herokit/foliage';
import { renderBuffer } from '../../../art/herokit/hi';
import { cornice, quoins, slateRoof, wallBlock } from '../../../art/herokit/masonry';
import { K, KM, R } from '../../../art/herokit/palette';
import { rngf } from '../../../art/herokit/rng';
import { window_ } from '../../../art/herokit/walls';
import { waterBand } from '../../../art/herokit/water';
import { type Band, B0, defineArt, defineBand, S_MID, VH, WATER_TPF } from './stage';
import { houseRow } from './scene';

const L = 'noon';
const X_ALL = (s: S): Uint8Array => new Uint8Array(s.w * s.h);

// ---------------------------------------------------------------------------------- the museum

/** The width of the museum's band. */
export const MUSEUM_W = 566;
/** The foot of the museum, and of all that stands on the middle plane's far side of the lawn. */
const MID_BASE = 126;

/** A long red-brick museum: wings, a central block with a four-arch passage, two towers with dark spires. */
function museum(W: number, seed: number): S {
  const H = 150;
  const s = new S(W, H);
  const r = rngf(seed);
  const bot = H;
  const cx = W >> 1;
  let pid = 100;
  const nid = (): number => (pid += 3);
  const wing = (x: number, w: number, top: number): void => {
    wallBlock(s, x, top, w, bot - top, 'brickr', nid(), 1, seed + x);
    slateRoof(
      s,
      [
        [x - 2, top],
        [x + 6, top - 18],
        [x + w - 6, top - 18],
        [x + w + 2, top],
      ],
      seed + x + 1,
      nid(),
      0.5,
    );
    for (const rx of range(x + 10, x + w - 10, 24)) {
      s.use(nid(), 1);
      s.poly(R.roof[2], [
        [rx - 2, top - 13],
        [rx + 4, top - 19],
        [rx + 10, top - 13],
      ]);
      const part = nid();
      window_(s, rx, top - 13, 9, 11, r, part, { z: 1.5, kind: r.int(0, 3) });
    }
    cornice(s, x, top, w, nid(), 2);
    for (const wx of range(x + 6, x + w - 10, 18)) {
      window_(s, wx, top + 13, 10, 22, r, nid(), { z: 3, arch: true });
      window_(s, wx + 1, bot - 31, 8, 14, r, nid(), { z: 3 });
    }
    s.use(nid(), 2);
    s.hl(R.white[0], x, bot - 41, w);
    s.hl(R.white[2], x, bot - 40, w);
    // A tile frieze.
    for (const q of range(x + 3, x + w - 6, 9)) {
      s.use(nid(), 2.5);
      s.rect(R.white[0], q, top + 5, 7, 5);
      s.rect(R.blue[2], q + 1, top + 6, 5, 3);
      s.px(R.yellow[1], q + 2, top + 7);
      s.px(R.white[0], q + 4, top + 7);
    }
    s.use(nid(), 2);
    s.rect(R.stone[1], x, bot - 7, w, 7);
    s.hl(R.stone[0], x, bot - 7, w);
    s.hl(R.stone[3], x, bot - 1, w);
    for (const q of range(x + 4, x + w, 11)) s.vl(R.stone[3], q, bot - 6, 5);
  };
  wing(0, cx - 82, 72);
  wing(cx + 82, W - cx - 82, 72);
  for (const px_ of [100, W - 160]) {
    wallBlock(s, px_, 56, 60, bot - 56, 'brickr', nid(), 3.2, seed + px_);
    slateRoof(
      s,
      [
        [px_ - 2, 56],
        [px_ + 10, 28],
        [px_ + 50, 28],
        [px_ + 62, 56],
      ],
      seed + px_ + 1,
      nid(),
      3.1,
    );
    cornice(s, px_, 56, 60, nid(), 3.4);
    quoins(s, px_, 60, bot - 68, 5, nid(), 3.4);
    quoins(s, px_ + 55, 60, bot - 68, 5, nid(), 3.4, true);
    window_(s, px_ + 16, 68, 28, 22, r, nid(), { z: 3.6, arch: true, kind: 2 });
    for (const wx of [px_ + 9, px_ + 24, px_ + 39]) window_(s, wx, bot - 33, 12, 18, r, nid(), { z: 3.6 });
  }
  const bw = 164;
  const bx = cx - (bw >> 1);
  wallBlock(s, bx, 50, bw, bot - 50, 'brickr', nid(), 4, seed + 3);
  slateRoof(
    s,
    [
      [bx, 50],
      [bx + 14, 28],
      [bx + bw - 14, 28],
      [bx + bw, 50],
    ],
    seed + 9,
    nid(),
    3.9,
  );
  cornice(s, bx, 50, bw, nid(), 4.2);
  cornice(s, bx, 80, bw, nid(), 4.2);
  for (const wx of range(bx + 8, bx + bw - 10, 16)) window_(s, wx, 58, 10, 17, r, nid(), { z: 4.4, arch: true });
  const aw = 30;
  const ag = 6;
  const n = 4;
  const ax0 = cx - ((n * aw + (n - 1) * ag) >> 1);
  // The two outline tones are flat (the kit adds no flecks to them), so the deep of an arch stays hard.
  const [h3, h2] = [K, KM];
  const [t0, t1, t2, t3] = R.stone;
  for (let i = 0; i < n; i++) {
    const ax = ax0 + i * (aw + ag);
    const pa = nid();
    const ring = X_ALL(s);
    const hole = X_ALL(s);
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const a = (X - (ax + aw / 2)) / (aw / 2 + 3);
        const b = (Y - 96) / (aw / 2 + 3);
        if (a * a + b * b < 1 && Y < 97) ring[Y * W + X] = 1;
        const c = (X - (ax + aw / 2)) / (aw / 2);
        const d = (Y - 96) / (aw / 2);
        if ((X >= ax && X < ax + aw && Y >= 96 && Y < bot) || c * c + d * d < 1) hole[Y * W + X] = 1;
      }
    }
    s.use(pa, 4.4);
    s.maskPaint(t1, ring);
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const k = Y * W + X;
        if (!ring[k]) continue;
        const an = Math.atan2(Y - 96, X - (ax + aw / 2) + 0.01);
        const odd = pyMod(Math.trunc(an * 7), 2);
        if (odd === 0) s.c[k] = t2;
        else if (X > ax + aw / 2) s.c[k] = t0;
      }
    }
    s.use(nid(), 4.6);
    s.maskPaint(h3, hole);
    s.use(nid(), 4.7);
    s.rect(h2, ax + 6, 104, aw - 12, bot - 104);
    s.use(nid(), 4.8);
    const sk = R.sky_n;
    s.rect(sk[4], ax + 9, 112, aw - 18, bot - 124);
    s.rect(R.far[1], ax + 9, 118, aw - 18, 6);
    s.rect(R.grass[1], ax + 9, bot - 12, aw - 18, 7);
    s.hl(R.grass[0], ax + 9, bot - 12, aw - 18);
    s.use(nid(), 4.9);
    s.vl(h3, ax + 6, 104, bot - 104);
    s.hl(h3, ax + 6, 104, aw - 12);
    s.use(nid(), 4.9);
    const lx = ax + (aw >> 1) - 1;
    s.vl(K, lx + 1, 80, 8);
    s.rect(R.glow[1], lx, 88, 3, 4);
    s.vl(R.glow[0], lx + 2, 88, 3);
    s.hl(R.hull[3], lx - 1, 92, 5);
    s.hl(R.hull[3], lx - 1, 87, 5);
    s.use(nid(), 5);
    const pl = ax + aw;
    if (i < n - 1) {
      s.rect(t1, pl, 97, ag, bot - 97);
      s.vl(t0, pl + ag - 1, 97, bot - 97);
      s.vl(t2, pl, 97, bot - 97);
      s.hl(t0, pl, 97, ag);
      s.hl(t3, pl, 99, ag);
    }
  }
  for (const tx of [cx - 74, cx + 46]) {
    const tw = 28;
    wallBlock(s, tx, 42, tw, bot - 42, 'brickr', nid(), 5.4, seed + tx);
    quoins(s, tx, 46, bot - 52, 4, nid(), 5.6);
    quoins(s, tx + tw - 4, 46, bot - 52, 4, nid(), 5.6, true);
    cornice(s, tx, 42, tw, nid(), 5.7);
    cornice(s, tx, 60, tw, nid(), 5.7);
    window_(s, tx + 9, 66, 10, 15, r, nid(), { z: 5.8, arch: true });
    // A steep spire, lit on the right.
    s.use(nid(), 5.1);
    s.poly(R.roof[2], [
      [tx - 1, 42],
      [tx + tw / 2, 12],
      [tx + tw / 2, 42],
    ]);
    s.use(nid(), 5.15);
    s.poly(R.roof[1], [
      [tx + tw / 2, 42],
      [tx + tw / 2, 12],
      [tx + tw + 1, 42],
    ]);
    for (const yy of range(16, 42, 4)) {
      const hw = ((yy - 12) * (tw / 2 + 1)) / 30;
      s.use(nid(), 5.16);
      s.hl(R.roof[3], tx + tw / 2 - hw * 0.8, yy, Math.max(1, Math.trunc(hw * 0.7)));
      s.hl(R.roof[0], tx + tw / 2 + hw * 0.15, yy, Math.max(1, Math.trunc(hw * 0.55)));
    }
    s.use(nid(), 5.2);
    s.vl(R.brass[1], tx + (tw >> 1), 7, 6);
    s.px(R.brass[0], tx + (tw >> 1), 6);
    s.use(nid(), 5.3);
    s.rect(R.glow[1], tx + (tw >> 1) - 2, 34, 5, 6);
    s.vl(R.glow[0], tx + (tw >> 1) + 2, 34, 6);
    s.hl(R.hull[3], tx + (tw >> 1) - 3, 33, 7);
    s.vl(R.hull[3], tx + (tw >> 1), 34, 6);
    // A clock.
    s.use(nid(), 5.9);
    s.ell(R.hull[3], tx + 14, 52, 5, 5);
    s.ell(R.white[0], tx + 14, 52, 4, 4);
    s.vl(K, tx + 14, 49, 3);
    s.hl(K, tx + 14, 52, 3);
    s.px(R.white[2], tx + 11, 54);
    s.px(R.white[2], tx + 12, 55);
  }
  // Banners on the wings.
  for (const [bxx, col] of [
    [cx - 96, 'dred'],
    [cx + 88, 'navy'],
  ] as const) {
    s.use(nid(), 6);
    const c = R[col];
    s.rect(c[1], bxx, 86, 9, 32);
    s.vl(c[0], bxx + 8, 86, 32);
    s.vl(c[2], bxx, 86, 32);
    s.hl(R.pole[1], bxx - 1, 85, 11);
    s.hl(c[3], bxx, 117, 9);
    for (let j = 0; j < 3; j++) {
      for (let q = 0; q < 3; q++) {
        const row = q === 1 ? '.w.' : 'w.w';
        for (let ii = 0; ii < 3; ii++) if (row[ii] === 'w') s.px(R.xw[0], bxx + 3 + ii, 90 + j * 9 + q);
      }
    }
  }
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

function paintMuseum(): S {
  const md = new S(MUSEUM_W, VH);
  const mu = museum(MUSEUM_W, 141);
  md.paste(mu, -1, MID_BASE - mu.h + 1);
  const he = hedge(70, 8, 3);
  for (const x of [10, 120, 330, 450]) md.paste(he, x, 118);
  return md;
}

export const MUSEUM: Band = defineBand({ light: L, name: 'b/museum', speed: S_MID, rows: [0, 128], width: MUSEUM_W, paint: paintMuseum });

// ------------------------------------------------------------------- beyond the museum: the plein's far side

/** Where the middle plane's far side starts (band x), and its width. */
export const PLEIN_FAR_X = MUSEUM_W - 4;
export const PLEIN_FAR_W = 1040;

/** The white museum: a long glass foot, and over it a white bath of a roof that leans out on the right. */
function whiteMuseum(): S {
  const s = new S(150, 76);
  const [w0, w1, w2, w3] = R.white;
  const [g0, g1, g2, g3] = R.glass;
  // The old brick wing behind it.
  wallBlock(s, 0, 8, 58, 68, 'brickr', 1, 0.5, 901);
  slateRoof(
    s,
    [
      [-2, 8],
      [4, 0],
      [54, 0],
      [60, 8],
    ],
    902,
    2,
    0.4,
  );
  cornice(s, 0, 8, 58, 3, 0.8);
  const r = rngf(903);
  for (const x of range(6, 50, 14)) {
    window_(s, x, 16, 8, 16, r, 4 + x, { z: 1, arch: true });
    window_(s, x, 42, 8, 14, r, 90 + x, { z: 1 });
  }
  // The glass foot, on thin white legs.
  s.use(4, 2);
  s.rect(g2, 38, 52, 100, 24);
  s.hl(g3, 38, 75, 100);
  for (const q of range(42, 138, 9)) s.vl(g3, q, 52, 24);
  for (const q of range(47, 134, 18)) {
    s.vl(g1, q, 54, 12);
    s.vl(g1, q + 1, 54, 6);
    s.px(g0, q + 1, 54);
  }
  s.use(45, 2.2);
  for (const q of [36, 92, 146]) {
    s.rect(w1, q, 50, 2, 26);
    s.vl(w0, q + 1, 50, 26);
  }
  // The bath: a long rounded white box, lit on the top and the right, shaded under its belly.
  s.use(5, 3);
  s.poly(w1, [
    [30, 22],
    [34, 16],
    [142, 16],
    [149, 22],
    [149, 44],
    [144, 50],
    [36, 50],
    [30, 44],
  ]);
  s.use(6, 3.2);
  s.poly(w0, [
    [34, 16],
    [142, 16],
    [149, 22],
    [149, 28],
    [32, 22],
  ]);
  s.use(7, 3.2);
  s.poly(w2, [
    [30, 40],
    [30, 44],
    [36, 50],
    [144, 50],
    [147, 46],
    [38, 46],
  ]);
  s.use(8, 3.3);
  s.hl(w3, 36, 50, 108);
  for (const q of range(44, 146, 17)) {
    s.vl(w2, q, 24, 22);
    s.px(w3, q, 46);
  }
  s.use(9, 3.5);
  text(s, 'STEDELIJK', 88, 32, R.hull[3]);
  s.use(10, 3.5);
  s.rect(R.glass[2], 44, 32, 26, 6);
  s.hl(R.glass[1], 44, 32, 26);
  for (const q of range(49, 70, 5)) s.vl(R.glass[3], q, 32, 6);
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** The concert hall: yellow and red brick in bands, a tall front with a pediment and a golden lyre. */
function concertHall(): S {
  const W = 236;
  const H = 110;
  const s = new S(W, H);
  const seed = 917;
  const r = rngf(seed);
  let pid = 10;
  const nid = (): number => (pid += 3);
  const bandMarks = (x: number, y: number, w: number, h: number, z: number): void => {
    s.use(nid(), z);
    for (const q of range(y, y + h, 7)) {
      s.hl(R.brickr[1], x, q, w);
      s.hl(R.brickr[2], x, q + 1, w);
    }
  };
  // The side wings with a copper roof.
  for (const [x, w] of [
    [0, 74],
    [162, 74],
  ] as const) {
    wallBlock(s, x, 54, w, H - 54, 'bricko', nid(), 1, seed + x);
    bandMarks(x, 60, w, H - 66, 1.2);
    s.use(nid(), 0.5);
    s.poly(R.iron[1], [
      [x - 1, 54],
      [x + 6, 38],
      [x + w - 6, 38],
      [x + w + 1, 54],
    ]);
    s.use(nid(), 0.6);
    for (const q of range(x + 8, x + w - 6, 7)) s.line(R.iron[2], q, 39, q - 2, 53);
    s.hl(R.iron[0], x + 6, 38, w - 12);
    cornice(s, x, 54, w, nid(), 1.4);
    for (const wx of range(x + 6, x + w - 8, 16)) {
      window_(s, wx, 62, 9, 20, r, nid(), { z: 2, arch: true });
      window_(s, wx, 90, 9, 13, r, nid(), { z: 2 });
    }
  }
  // The middle block.
  const bx = 62;
  const bw = 112;
  wallBlock(s, bx, 34, bw, H - 34, 'bricko', nid(), 3, seed + 5);
  bandMarks(bx, 40, bw, H - 46, 3.1);
  quoins(s, bx, 38, H - 44, 5, nid(), 3.2);
  quoins(s, bx + bw - 5, 38, H - 44, 5, nid(), 3.2, true);
  // The roof and the pediment.
  s.use(nid(), 2.4);
  s.poly(R.iron[1], [
    [bx + 2, 34],
    [bx + 14, 10],
    [bx + bw - 14, 10],
    [bx + bw - 2, 34],
  ]);
  s.use(nid(), 2.5);
  for (const q of range(bx + 16, bx + bw - 14, 8)) s.line(R.iron[2], q, 11, q - 6, 33);
  s.hl(R.iron[0], bx + 14, 10, bw - 28);
  s.use(nid(), 3.4);
  s.poly(R.stone[1], [
    [bx + 6, 36],
    [bx + (bw >> 1), 16],
    [bx + bw - 6, 36],
  ]);
  s.use(nid(), 3.5);
  s.line(R.stone[0], bx + (bw >> 1), 16, bx + bw - 6, 35);
  s.line(R.stone[2], bx + 6, 35, bx + (bw >> 1), 16);
  s.hl(R.stone[3], bx + 6, 36, bw - 12);
  s.hl(R.stone[0], bx + 4, 37, bw - 8);
  // The golden lyre on the top.
  s.use(nid(), 3.6);
  const lx = bx + (bw >> 1);
  s.grid(['a...a', 'a.b.b', 'b.b.b', '.bbb.', '..c..', '.ccc.'], lx - 2, 8, { a: R.brass[0], b: R.brass[1], c: R.brass[2] });
  // Three tall windows and the doors under them.
  for (const q of [0, 1, 2]) {
    const wx = bx + 18 + q * 28;
    window_(s, wx, 44, 20, 28, r, nid(), { z: 4, arch: true, kind: 2 });
    s.use(nid(), 4.1);
    s.rect(R.stone[1], wx - 2, 74, 24, 2);
    s.hl(R.stone[0], wx - 2, 74, 24);
    s.use(nid(), 4.2);
    s.rect(R.dgreen[2], wx + 3, 84, 14, H - 86);
    s.vl(R.dgreen[1], wx + 15, 84, H - 86);
    s.hl(R.stone[0], wx + 2, 83, 16);
    s.vl(R.dgreen[3], wx + 9, 85, H - 87);
  }
  s.use(nid(), 4.4);
  s.rect(R.stone[1], bx, H - 6, bw, 6);
  s.hl(R.stone[0], bx, H - 6, bw);
  s.hl(R.stone[3], bx, H - 1, bw);
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

function paintPleinFar(): S {
  const s = new S(PLEIN_FAR_W, VH);
  // Far houses behind the concert hall and at the end of the plein.
  const row = new S(PLEIN_FAR_W, VH);
  houseRow(row, MID_BASE, 931, { sh: 16, gr: 20, gh: 20, ww: 8, wh: 10, wmin: 38, wmax: 56 });
  s.paste(row, 0, 0);
  // The ground between them.
  const gr = hedge(PLEIN_FAR_W, 8, 941);
  s.paste(gr, 0, 118);
  const wm = whiteMuseum();
  s.paste(wm, 66, MID_BASE - wm.h + 1);
  const ch = concertHall();
  s.paste(ch, 320, MID_BASE - ch.h + 1);
  // Still trees on the far side of the lawn: the near ones sway, these do not need to.
  for (const [x, cw, sd] of [
    [12, 54, 951],
    [226, 64, 952],
    [276, 48, 953],
    [566, 58, 954],
    [640, 66, 955],
    [744, 56, 956],
    [860, 62, 957],
    [958, 58, 958],
  ] as const) {
    const ch2 = Math.trunc(cw * 0.86);
    trunk(s, x + (cw >> 1), MID_BASE, ch2 - 6, 4, sd);
    s.paste(crown(cw, ch2, sd, 0), x, MID_BASE - ch2 - 16);
  }
  const he = hedge(90, 8, 961);
  for (const x of [150, 590, 800]) s.paste(he, x, 118);
  return s;
}

export const PLEIN_FAR: Band = defineBand({ light: L, name: 'b/plein-far', speed: S_MID, rows: [0, 128], width: PLEIN_FAR_W, paint: paintPleinFar });

// ------------------------------------------------------------------------------------- the lawn

export const S_LAWN = 0.66;
export const LAWN_W = 1640;
const POOLS: ReadonlyArray<readonly [number, number]> = [
  [90, 250],
  [430, 260],
  [846, 344],
];
const POOL_ROWS: readonly [number, number] = [129, 143];
/** Trees on the lawn (band x). */
export const LAWN_TREES: readonly number[] = [30, 370, 712, 790, 1236, 1330, 1432, 1560];
/** The canvas of a crown on the lawn, a little wider than its clumps. */
export const LAWN_CROWN: readonly [number, number] = [60, 50];
/** The fountain jets in the long pool (band x, on the lawn's plane). */
export const FOUNTAINS: readonly number[] = [920, 1018, 1116];

/** A bed of tulips on the lawn: rows of one colour, each flower a hard little cluster. */
function tulipBed(s: S, x: number, w: number, seed: number): void {
  const r = rngf(seed);
  const colours = ['tulip', 'yellow', 'dred', 'tulip', 'cloth'];
  let part = 500 + seed % 40;
  s.use(part++, 1);
  s.rect(R.leaf[2], x, 131, w, 12);
  s.hl(R.leaf[3], x, 142, w);
  s.hl(R.leaf[1], x, 131, w);
  for (let j = 0; j < 3; j++) {
    const c = R[colours[pyMod(seed + j * 2, colours.length)]];
    const y = 132 + j * 4;
    for (let q = x + 1 + (j % 2); q < x + w - 2; q += 3) {
      const dy = r.int(0, 2);
      s.px(c[1], q, y + dy);
      s.px(c[0], q + 1, y + dy);
      s.px(c[2] ?? c[1], q, y + dy + 1);
    }
  }
}

/** A picnic: a checked blanket with a basket on it, seen from afar. Small and hard. */
function picnic(s: S, x: number, y: number, col: string): void {
  const c = R[col];
  s.use(540 + (x % 30), 1.5);
  for (let j = 0; j < 4; j++) {
    for (let q = 0; q < 8; q++) {
      s.rect((q + (j >> 1)) % 2 ? R.cloth[0] : c[1], x + 2 - (j >> 1) + q * 3, y + j, 3, 1);
    }
  }
  s.hl(c[3], x, y + 4, 25);
  s.use(575 + (x % 20), 2);
  s.rect(R.wood[1], x + 15, y - 2, 6, 3);
  s.hl(R.wood[0], x + 15, y - 2, 6);
  s.hl(R.wood[3], x + 15, y + 1, 6);
  s.vl(R.brass[2], x + 17, y - 3, 1);
}

function paintLawn(): S {
  const la = new S(LAWN_W, VH);
  grass(la, 124, B0 + 6, 151);
  const rm = R.stone;
  for (const [px_, pw] of POOLS) {
    la.use(2, 1);
    la.rect(rm[1], px_ - 3, 127, pw + 6, 18);
    la.hl(rm[0], px_ - 3, 127, pw + 6);
    la.hl(rm[3], px_ - 3, 144, pw + 6);
    la.hl(rm[2], px_ - 3, 143, pw + 6);
  }
  tulipBed(la, 700, 38, 3);
  tulipBed(la, 752, 34, 8);
  tulipBed(la, 1206, 44, 12);
  tulipBed(la, 1290, 30, 15);
  tulipBed(la, 1360, 54, 19);
  picnic(la, 355, 138, 'dred');
  picnic(la, 800, 137, 'navy');
  picnic(la, 1480, 138, 'dgreen');
  LAWN_TREES.forEach((x, i) => trunk(la, x, 138, 28, 4, 700 + i));
  return la;
}

export const LAWN: Band = defineBand({ light: L, name: 'b/lawn', speed: S_LAWN, rows: [124, B0 + 6], width: LAWN_W, paint: paintLawn });

/** What the pools reflect: the middle plane laid out along the lawn. */
function reflected(): ReturnType<typeof renderBuffer> {
  const s = new S(LAWN_W, VH);
  s.paste(paintMuseum(), 0, 0);
  s.paste(paintPleinFar(), PLEIN_FAR_X, 0);
  return renderBuffer(s, L, 1, 0);
}

export const POOL: Band = defineBand({
  light: L,
  name: 'b/pool',
  speed: S_LAWN,
  rows: POOL_ROWS,
  width: LAWN_W,
  anim: 3,
  tpf: WATER_TPF.mid,
  paint: () => {
    const src = reflected();
    return [0, 1, 2].map((f) => {
      const wb = waterBand(LAWN_W, POOL_ROWS[0], POOL_ROWS[1], src, 153, f);
      for (let y = 0; y < wb.h; y++) {
        for (let x = 0; x < wb.w; x++) {
          if (!POOLS.some(([p, w]) => x >= p && x < p + w)) wb.c[y * wb.w + x] = 0;
        }
      }
      return wb;
    });
  },
});

export const lawnCrownId = (i: number): string =>
  defineArt(L, `b/lawn-crown-${i}`, () => swayCrown(LAWN_CROWN[0], LAWN_CROWN[1], 700 + i), { anchor: 'tl' });

/** A jet of the fountain: it rises and falls in hard clusters. Stands on the pool. */
export const FOUNTAIN = defineArt(
  L,
  'b/fountain',
  () => {
    const [w0, w1] = R.water;
    const shapes = [
      [10, 3],
      [12, 5],
      [14, 4],
      [11, 6],
    ] as const;
    return shapes.map(([h, sp]) => {
      const s = new S(20, 18);
      s.use(1, 1);
      const cx = 9;
      const top = 16 - h;
      s.rect(w1, cx, top, 2, h);
      s.vl(R.cloth[0], cx + 1, top, h - 2);
      for (const dir of [-1, 1]) {
        for (let k = 1; k <= sp; k++) {
          const yy = top + ((k * k) >> 1);
          s.px(w0, cx + (dir < 0 ? 0 : 1) + dir * k, yy);
          s.px(w1, cx + (dir < 0 ? 0 : 1) + dir * k, yy + 1);
        }
      }
      s.hl(w0, cx - 3, 16, 8);
      s.hl(w1, cx - 4, 17, 10);
      return s;
    });
  },
  { ticksPerFrame: 9 },
);
