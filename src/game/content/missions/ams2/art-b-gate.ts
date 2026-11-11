/**
 * THE PASSAGE of section b (noon): the museum's gate at speed 1, painted from the terrain's numbers. The
 * solid ceiling (`B_PASSAGE`, `B_CEILING_Y`, 12 px thick) is the stone lintel with the museum's name; over
 * it the brick storey and the roof, at each end a clock tower, under it the back wall's arches that look
 * out onto the lawn. The floor under it has its own stones, in shade.
 */
import { addMargin, S, text, textW } from '../../../art/herokit/canvas';
import { range, pyMod } from '../../../art/herokit/canvas-math';
import { pavers } from '../../../art/herokit/floors';
import { cornice, quoins, slateRoof, wallBlock } from '../../../art/herokit/masonry';
import { K, KM, R } from '../../../art/herokit/palette';
import { rngf } from '../../../art/herokit/rng';
import { window_ } from '../../../art/herokit/walls';
import { B_CEILING_Y, B_PASSAGE, G } from '../ams/terrain';
import { type Band, B1, B2, defineArt, defineBand, S_WALK, VH } from './stage';

const L = 'noon';
const TOWER_W = 44;
/** The gate's left edge in world x, and its width. */
export const GATE_X = B_PASSAGE[0] - TOWER_W;
export const GATE_W = B_PASSAGE[1] - B_PASSAGE[0] + 2 * TOWER_W;
const LINTEL_Y = B_CEILING_Y - 12;
const CANVAS_H = B1;

function tower(s: S, x: number, nid: () => number, seed: number, r: ReturnType<typeof rngf>, banner: string): void {
  const w = TOWER_W;
  wallBlock(s, x, 16, w, CANVAS_H - 16, 'brickr', nid(), 5, seed);
  // The spire, cut by the top of the view: lit on the right.
  s.use(nid(), 4.6);
  s.poly(R.roof[2], [
    [x - 2, 17],
    [x + (w >> 1), -14],
    [x + (w >> 1), 17],
  ]);
  s.use(nid(), 4.7);
  s.poly(R.roof[1], [
    [x + (w >> 1), 17],
    [x + (w >> 1), -14],
    [x + w + 2, 17],
  ]);
  s.use(nid(), 4.8);
  for (const yy of range(1, 16, 4)) {
    const hw = ((yy + 14) * (w / 2 + 2)) / 31;
    s.hl(R.roof[3], x + w / 2 - hw * 0.85, yy, Math.max(1, Math.trunc(hw * 0.7)));
    s.hl(R.roof[0], x + w / 2 + hw * 0.15, yy, Math.max(1, Math.trunc(hw * 0.6)));
  }
  cornice(s, x - 1, 16, w + 2, nid(), 5.6);
  quoins(s, x, 20, CANVAS_H - 34, 5, nid(), 5.5);
  quoins(s, x + w - 5, 20, CANVAS_H - 34, 5, nid(), 5.5, true);
  // The clock.
  const cx = x + (w >> 1);
  s.use(nid(), 5.7);
  s.ell(R.stone[1], cx, 34, 10, 10);
  s.ell(R.hull[3], cx, 34, 8, 8);
  s.ell(R.white[0], cx, 34, 7, 7);
  s.use(nid(), 5.8);
  s.ell(R.white[1], cx - 1, 35, 5, 5);
  s.px(R.white[0], cx + 1, 33);
  for (const [dx, dy] of [
    [0, -6],
    [6, 0],
    [0, 6],
    [-6, 0],
  ] as const) {
    s.px(R.hull[3], cx + dx, 34 + dy);
  }
  s.vl(K, cx, 29, 6);
  s.hl(K, cx, 34, 5);
  cornice(s, x, 46, w, nid(), 5.6);
  // An arched window and a banner.
  // Under the string course: its arched head stays clear of the course and the clock.
  window_(s, x + 11, 58, 22, 21, r, nid(), { z: 5.8, arch: true, kind: 2 });
  s.use(nid(), 5.7);
  s.rect(R.stone[1], x + 9, 80, 26, 2);
  s.hl(R.stone[0], x + 9, 80, 26);
  s.hl(R.stone[3], x + 9, 82, 26);
  const c = R[banner];
  s.use(nid(), 6);
  s.rect(c[1], x + 13, 90, 18, 40);
  s.vl(c[0], x + 30, 90, 40);
  s.vl(c[2], x + 13, 90, 40);
  s.hl(R.pole[1], x + 11, 89, 22);
  s.hl(R.pole[3], x + 11, 88, 22);
  for (let j = 0; j < 3; j++) {
    const yy = 94 + j * 11;
    for (const [q, dy] of [
      [0, 0],
      [4, 0],
      [1, 1],
      [3, 1],
      [2, 2],
      [1, 3],
      [3, 3],
      [0, 4],
      [4, 4],
    ] as const) {
      s.px(R.xw[0], x + 20 + q, yy + dy);
    }
  }
  s.hl(c[3], x + 13, 129, 18);
  // The plinth and a small door.
  s.use(nid(), 5.6);
  s.rect(R.stone[1], x, CANVAS_H - 14, w, 14);
  s.hl(R.stone[0], x, CANVAS_H - 14, w);
  s.hl(R.stone[3], x, CANVAS_H - 1, w);
  s.hl(R.stone[2], x, CANVAS_H - 8, w);
  for (const q of range(x + 3, x + w, 9)) s.vl(R.stone[3], q, CANVAS_H - 13, 5);
  for (const q of range(x + 7, x + w, 9)) s.vl(R.stone[3], q, CANVAS_H - 7, 6);
}

/** Where the trees stand in each arch's view: shares of its width (−1: no tree). */
const ARCH_TREES: ReadonlyArray<readonly [number, number]> = [
  [0.22, 0.68],
  [0.72, -1],
  [0.5, 0.86],
  [0.34, -1],
  [0.14, 0.82],
  [0.62, -1],
];

/** What an arch looks out on: the sky, far roofs, the crowns of the plein, a hedge, the lawn, the gravel. */
function openingView(s: S, x: number, y: number, w: number, h: number, i: number, nid: () => number): void {
  const r = rngf(177 + i * 5);
  const lawnY = y + h - 19;
  const pathY = y + h - 8;
  s.use(nid(), 2.5);
  s.rect(R.sky_n[3], x, y, w, 8);
  s.rect(R.sky_n[4], x, y + 8, w, lawnY - y - 8);
  // Far roofs.
  s.use(nid(), 2.52);
  for (let q = x; q < x + w; ) {
    const bw = r.int(3, 7);
    const bh = r.int(4, 10);
    s.rect(R.far[r.int(0, 3)], q, lawnY - 7 - bh, Math.min(bw, x + w - q), bh + 7);
    q += bw;
  }
  // Crowns, each a lump with a lit top right.
  const [t0, t1] = ARCH_TREES[i % ARCH_TREES.length];
  for (const [t, u] of [t0, t1].entries()) {
    if (u < 0) continue;
    const cx = x + Math.trunc(u * w);
    const ry = 5 + ((i * 2 + t) % 4);
    s.use(nid(), 2.56);
    s.vl(R.bark[2], cx, lawnY - 5, 5);
    s.ell(R.leaf[2], cx, lawnY - 6 - ry, ry + 1, ry);
    s.ell(R.leaf[1], cx + 1, lawnY - 7 - ry, ry - 2, ry - 2);
    s.px(R.leaf[0], cx + 2, lawnY - 8 - ry);
    s.px(R.leaf[0], cx + 3, lawnY - 6 - ry);
    s.hl(R.leaf[3], cx - ry, lawnY - 5, 2 * ry);
  }
  // The lawn, the hedge along it, and the gravel.
  s.use(nid(), 2.6);
  s.rect(R.grass[1], x, lawnY, w, pathY - lawnY);
  s.hl(R.grass[0], x, lawnY, w);
  for (let q = x + (i % 4); q < x + w; q += 5) s.px(R.grass[2], q, lawnY + 3 + (q % 3));
  s.use(nid(), 2.62);
  s.rect(R.leaf[2], x, lawnY - 3, w, 3);
  s.hl(R.leaf[1], x, lawnY - 3, w);
  s.use(nid(), 2.64);
  s.rect(R.gravel[1], x, pathY, w, y + h - pathY);
  s.hl(R.gravel[0], x, pathY, w);
  for (let q = x + 1; q < x + w; q += 4) s.px(R.gravel[2], q, pathY + 2 + (q % 3));
  // Each arch looks at its own stretch: a lamp, a flag, a far tower, a cyclist, a fountain, a kiosk.
  s.use(nid(), 2.7);
  const lamp = (lx: number): void => {
    s.vl(R.iron[2], lx, lawnY - 12, 12);
    s.rect(R.glow[1], lx - 1, lawnY - 15, 3, 3);
  };
  const flag = (fx: number): void => {
    s.vl(R.pole[1], fx, lawnY - 18, 18);
    s.rect(R.dred[1], fx + 1, lawnY - 18, 7, 2);
    s.rect(R.cloth[0], fx + 1, lawnY - 16, 7, 1);
    s.rect(R.navy[1], fx + 1, lawnY - 15, 7, 2);
  };
  switch (i % 6) {
    case 0:
      lamp(x + w - 5);
      break;
    case 1:
      // A far tower over the roofs.
      s.rect(R.far[1], x + 8, y + 3, 5, lawnY - y - 10);
      s.poly(R.far[2], [
        [x + 7, y + 3],
        [x + 10, y - 3],
        [x + 13, y + 3],
      ]);
      s.px(R.white[1], x + 10, y + 6);
      break;
    case 2:
      flag(x + 5);
      break;
    case 3:
      // A cyclist on the gravel.
      s.ell(R.iron[2], x + 6, pathY + 2, 2, 2);
      s.ell(R.iron[2], x + 12, pathY + 2, 2, 2);
      s.rect(R.dred[1], x + 8, pathY - 5, 3, 5);
      s.rect(R.skin[1], x + 8, pathY - 8, 3, 3);
      lamp(x + w - 3);
      break;
    case 4:
      // A fountain in the far pool.
      s.vl(R.water[1], x + (w >> 1), lawnY - 10, 9);
      s.hl(R.water[1], x + (w >> 1) - 2, lawnY - 10, 5);
      s.hl(R.water[0], x + (w >> 1) - 3, lawnY - 1, 7);
      break;
    default:
      // A kiosk with a striped roof.
      s.rect(R.dred[1], x + 4, lawnY - 10, 9, 2);
      s.rect(R.cloth[0], x + 5, lawnY - 8, 7, 8);
      s.rect(R.glass[2], x + 6, lawnY - 6, 3, 3);
      flag(x + w - 6);
      break;
  }
}

function paintGate(): S {
  const s = new S(GATE_W, CANVAS_H);
  const seed = 171;
  const r = rngf(seed);
  let pid = 100;
  const nid = (): number => (pid += 3);
  const x0 = TOWER_W;
  const x1 = GATE_W - TOWER_W;
  const w = x1 - x0;
  // The brick storey over the ceiling.
  const top = 28;
  wallBlock(s, x0, top, w, LINTEL_Y - top, 'brickr', nid(), 1, seed + 1);
  slateRoof(
    s,
    [
      [x0 - 2, top],
      [x0 + 10, 2],
      [x1 - 10, 2],
      [x1 + 2, top],
    ],
    seed + 2,
    nid(),
    0.5,
  );
  cornice(s, x0, top, w, nid(), 2);
  // Dormers, each its own small roof.
  for (const rx of range(x0 + 22, x1 - 20, 46)) {
    s.use(nid(), 1);
    s.poly(R.roof[2], [
      [rx - 3, 21],
      [rx + 6, 10],
      [rx + 15, 21],
    ]);
    s.use(nid(), 1.1);
    s.line(R.roof[0], rx + 6, 10, rx + 15, 21);
    window_(s, rx, 16, 12, 12, r, nid(), { z: 1.5, kind: r.int(0, 3) });
  }
  // The frieze of tiles.
  for (const q of range(x0 + 4, x1 - 8, 10)) {
    s.use(nid(), 2.5);
    s.rect(R.white[0], q, top + 5, 8, 5);
    s.rect(R.blue[2], q + 1, top + 6, 6, 3);
    s.px(R.yellow[1], q + 3, top + 7);
    s.px(R.white[0], q + 5, top + 7);
  }
  // The tall windows, with a stone arch and a sill.
  for (const wx of range(x0 + 11, x1 - 16, 31)) {
    window_(s, wx, top + 15, 17, 30, r, nid(), { z: 3, arch: true });
    s.use(nid(), 2.6);
    s.rect(R.stone[1], wx - 2, top + 45, 21, 2);
    s.hl(R.stone[0], wx - 2, top + 45, 21);
    s.hl(R.stone[3], wx - 2, top + 47, 21);
  }
  // THE PASSAGE: the back wall, in shade.
  const vTop = B_CEILING_Y;
  const k = wallBlock(s, x0, vTop, w, CANVAS_H - vTop, 'brickr', nid(), 1, seed + 4);
  s.retone(k, [
    [R.brickr[1], R.brickr[2]],
    [R.brickr[0], R.brickr[1]],
    [R.brickr[2], R.brickr[3]],
  ]);
  const n = 6;
  const aw = 44;
  const ag = 9;
  const ax0 = x0 + ((w - (n * aw + (n - 1) * ag)) >> 1);
  const spring = 122;
  const foot = CANVAS_H - 6;
  const [t0, t1, t2, t3] = R.stone;
  // The deep of the arches: the two outline tones are flat (the kit adds no flecks to them), so the dark stays hard.
  const h1 = R.hull[1];
  const [h2, h3] = [KM, K];
  const W = s.w;
  for (let i = 0; i < n; i++) {
    const ax = ax0 + i * (aw + ag);
    const ca = ax + aw / 2;
    const ring = new Uint8Array(s.c.length);
    const hole = new Uint8Array(s.c.length);
    for (let Y = vTop; Y < CANVAS_H; Y++) {
      for (let X = Math.max(0, ax - 4); X < Math.min(W, ax + aw + 4); X++) {
        const a = (X - ca) / (aw / 2 + 3);
        const b = (Y - spring) / (aw / 2 + 3);
        if (a * a + b * b < 1 && Y <= spring) ring[Y * W + X] = 1;
        const c = (X - ca) / (aw / 2);
        const d = (Y - spring) / (aw / 2);
        if ((X >= ax && X < ax + aw && Y >= spring && Y < foot) || c * c + d * d < 1) hole[Y * W + X] = 1;
      }
    }
    s.use(nid(), 2);
    s.maskPaint(t1, ring);
    for (let Y = vTop; Y <= spring; Y++) {
      for (let X = Math.max(0, ax - 4); X < Math.min(W, ax + aw + 4); X++) {
        const q = Y * W + X;
        if (!ring[q]) continue;
        const an = Math.atan2(Y - spring, X - ca + 0.01);
        const odd = pyMod(Math.trunc(an * 8), 2);
        if (odd === 0) s.c[q] = t2;
        else if (X > ca) s.c[q] = t0;
      }
    }
    s.use(nid(), 2.2);
    s.maskPaint(h2, hole);
    // The deep of the arch, and the bright plein at its end: each arch looks at its own stretch of it.
    s.use(nid(), 2.4);
    s.rect(h3, ax + 6, spring - 10, aw - 12, foot - spring + 10);
    const ox = ax + 9;
    const ow = aw - 18;
    const oy = spring - 7;
    openingView(s, ox, oy, ow, foot - oy, i, nid);
    s.use(nid(), 2.8);
    s.vl(h1, ax + 6, spring - 10, foot - spring + 10);
    s.hl(h1, ax + 6, spring - 10, aw - 12);
    // The pier to its right.
    if (i < n - 1) {
      const pl = ax + aw;
      s.use(nid(), 3);
      s.rect(t1, pl, spring, ag, foot - spring);
      s.vl(t0, pl + ag - 1, spring, foot - spring);
      s.vl(t2, pl, spring, foot - spring);
      s.hl(t0, pl, spring, ag);
      s.hl(t3, pl, spring + 2, ag);
      for (const q of range(spring + 8, foot, 9)) s.hl(t3, pl, q, ag - 1);
      if (i === 0 || i === 3) {
        // The round blue sign of the cycle path.
        s.use(nid(), 3.2);
        s.ell(R.blue[3], pl + 4, spring + 12, 4, 4);
        s.ell(R.blue[1], pl + 4, spring + 12, 3, 3);
        s.px(R.cloth[0], pl + 2, spring + 13);
        s.px(R.cloth[0], pl + 6, spring + 13);
        s.hl(R.cloth[0], pl + 3, spring + 11, 3);
      }
    }
  }
  // The plinth of the back wall.
  s.use(nid(), 3.2);
  s.rect(t2, x0, foot, w, CANVAS_H - foot);
  s.hl(t1, x0, foot, w);
  s.hl(t3, x0, CANVAS_H - 1, w);
  // Lanterns on chains from the ceiling, one over each pier.
  for (let i = 0; i < n - 1; i++) {
    const lx = ax0 + i * (aw + ag) + aw + (ag >> 1) - 1;
    s.use(nid(), 3.6);
    s.vl(h3, lx + 1, vTop, 8);
    s.hl(h3, lx - 1, vTop + 8, 5);
    s.rect(R.glow[1], lx - 1, vTop + 9, 5, 6);
    s.vl(R.glow[0], lx + 3, vTop + 9, 6);
    s.vl(R.glow[2], lx - 1, vTop + 9, 6);
    s.hl(h3, lx - 1, vTop + 15, 5);
    s.vl(h3, lx + 1, vTop + 9, 6);
  }
  // The shadow under the ceiling.
  s.use(nid(), 3.8);
  s.rect(h3, x0, vTop, w, 2);
  s.hl(h2, x0, vTop + 2, w);
  // THE CEILING: the stone lintel, as thick as the terrain's solid.
  s.use(nid(), 4);
  s.rect(t1, x0, LINTEL_Y, w, 12);
  s.hl(R.white[0], x0, LINTEL_Y, w);
  s.hl(R.white[1], x0, LINTEL_Y + 1, w);
  s.hl(t2, x0, LINTEL_Y + 2, w);
  s.hl(t2, x0, B_CEILING_Y - 2, w);
  s.hl(t3, x0, B_CEILING_Y - 1, w);
  s.use(nid(), 4.1);
  for (const q of range(x0 + 7, x1, 23)) s.vl(t2, q, LINTEL_Y + 3, 7);
  for (const q of range(x0 + 8, x1, 23)) s.vl(t0, q, LINTEL_Y + 3, 7);
  // The name, on a dark plate in the middle.
  const label = 'RIJKSMUSEUM';
  const tw = textW(label, 2);
  const lx = x0 + ((w - tw) >> 1);
  s.use(nid(), 4.4);
  s.rect(R.navy[2], lx - 4, LINTEL_Y + 2, tw + 8, 8);
  s.hl(R.navy[1], lx - 4, LINTEL_Y + 2, tw + 8);
  s.hl(R.navy[3], lx - 4, LINTEL_Y + 9, tw + 8);
  s.use(nid(), 4.5);
  text(s, label, lx, LINTEL_Y + 3, R.brass[0], 2);
  // The towers last: they stand in front of it all.
  tower(s, 0, nid, seed + 7, r, 'dred');
  tower(s, x1, nid, seed + 9, r, 'navy');
  s.finish(KM);
  return s;
}

export const GATE: Band = defineBand({ light: L, name: 'b/gate', speed: S_WALK, rows: [0, CANVAS_H], width: GATE_W, paint: paintGate });

/** The floor under the passage: slabs in the shade of the museum, a threshold stone at each end. */
export const PASSAGE_FLOOR: Band = defineBand({
  light: L,
  name: 'b/passage-floor',
  speed: S_WALK,
  rows: [B1, B2],
  width: B_PASSAGE[1] - B_PASSAGE[0],
  paint: () => {
    const s = new S(B_PASSAGE[1] - B_PASSAGE[0], VH);
    // The cold shade of the museum: flat slabs and hard joints, in the steel ramp that takes no flecks.
    pavers(s, B1, B2, 173, 4, 6, 2.2, 'pole', 0.33);
    const [a, b, , d] = R.pole;
    const [f0, f1] = R.farr;
    const k = new Uint8Array(s.c.length).fill(1);
    s.retone(k, [
      [b, f1],
      [a, f0],
    ]);
    // A band of light along the back wall would be a gradient: only the hard shadow of the wall.
    s.use(9, 2);
    s.hl(K, 0, B1, s.w);
    s.hl(d, 0, B1 + 1, s.w);
    for (const x of [0, s.w - 4]) {
      s.use(10, 2);
      s.rect(R.stone[2], x, B1, 4, B2 - B1);
      s.vl(R.stone[1], x + 3, B1, B2 - B1);
      s.vl(R.stone[3], x, B1, B2 - B1);
    }
    return s;
  },
});

/**
 * The pier at a mouth of the passage. It stands on the walk line and draws behind the figures: nothing drawn over
 * the world may cover a hero's head or gun.
 */
export const PIER_FOOT = G + 4;
export const MOUTH_PIER = defineArt(L, 'b/mouth-pier', () => {
  const H = PIER_FOOT - LINTEL_Y;
  const s = new S(16, H);
  const [t0, t1, t2, t3] = R.stone;
  s.use(1, 1);
  s.rect(t1, 1, 4, 14, H - 12);
  s.vl(t0, 14, 4, H - 12);
  s.vl(t2, 1, 4, H - 12);
  s.vl(t2, 2, 4, H - 12);
  for (let y = 10; y < H - 10; y += 10) {
    s.hl(t3, 1, y, 14);
    s.hl(t0, 3, y + 1, 11);
  }
  s.use(2, 2);
  s.rect(t1, 0, 0, 16, 5);
  s.hl(R.white[0], 0, 0, 16);
  s.hl(t3, 0, 4, 16);
  s.vl(t0, 15, 1, 3);
  s.use(3, 2);
  s.rect(t1, 0, H - 9, 16, 9);
  s.hl(t0, 0, H - 9, 16);
  s.hl(t3, 0, H - 1, 16);
  s.vl(t0, 15, H - 8, 7);
  s.vl(t3, 0, H - 8, 7);
  const o = addMargin(s);
  o.finish();
  return o;
});
