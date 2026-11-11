/** Street furniture: hand-drawn grids, then selout + outline, at the heroes' scale (docs/design/ams2.md §1.1 #6). */
import { addMargin, S, text, textW } from './canvas';
import { pyRound } from './canvas-math';
import { STAMPS } from './foliage';
import { K, KM, R } from './palette';
import { rngf } from './rng';
import { window_ } from './walls';

const POST = ['..bba..', '.cbbaa.', 'cbbbbaa', 'cbbbbba', 'ddcccdd', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'ccbbbaa', 'dddcccc'];
const POST_FAR = ['..bba..', '.cbbaa.', 'cbbbbba', 'ddcccdd', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'cbbbbba', 'cwdddwa', 'cdwdwda', 'cddwdda', 'cdwdwda', 'cwdddwa', 'ccbbbaa', 'dddcccc'];

/** An Amsterdammertje: a round cast post, a round head, a collar, three white crosses. Sprites come with their margin. */
export function post(far = false): S {
  const rows = far ? POST_FAR : POST;
  const [a, b, c, d] = R.bollard;
  const s = new S(rows[0].length, rows.length);
  s.use(1, 1);
  s.grid(rows, 0, 0, { a, b, c, d, w: R.xw[0] });
  const o = addMargin(s);
  o.finish();
  return o;
}

/** A pole: hard bands, lit right. */
export function tube(s: S, col: string, x: number, y: number, w: number, h: number): void {
  const [a, b, c, d] = R[col];
  s.rect(b, x, y, w, h);
  s.vl(c, x, y, h);
  if (w >= 3) s.vl(a, w >= 4 ? x + w - 2 : x + w - 1, y, h);
  if (w >= 5) {
    s.vl(d, x, y, h);
    s.vl(c, x + 1, y, h);
  }
}

/** A green iron street lantern, drawn at the heroes' scale. */
export function lamp(h = 70): S {
  const [a, b, c, d] = R.iron;
  const [g0, g1, g2] = R.glow;
  const s = new S(15, h);
  const mid = 7;
  s.use(1, 1);
  tube(s, 'iron', mid - 1, 18, 4, h - 26);
  s.use(2, 2);
  // The foot.
  tube(s, 'iron', mid - 2, h - 14, 6, 5);
  tube(s, 'iron', mid - 3, h - 9, 8, 5);
  tube(s, 'iron', mid - 4, h - 4, 10, 4);
  s.hl(a, mid - 3, h - 9, 8);
  s.hl(a, mid - 4, h - 4, 10);
  s.hl(a, mid - 2, h - 14, 6);
  // The rings on the post.
  s.use(3, 2.5);
  tube(s, 'iron', mid - 2, 30, 6, 2);
  s.hl(a, mid - 2, 30, 6);
  tube(s, 'iron', mid - 2, 44, 6, 2);
  // The scrolls.
  s.use(4, 2.5);
  s.grid(['cb.......bc', 'c.b.....b.c', '.b.b...b.b.', '...b...b...'], mid - 5, 19, { b, c: a });
  // Lantern.
  s.use(5, 3);
  s.grid(['..a..', '.bab.', 'bbbba'], mid - 2, 0, { a, b });
  s.rect(d, mid - 5, 3, 12, 1);
  s.hl(a, mid + 1, 3, 6);
  for (let j = 0; j < 10; j++) {
    const w = 10 - (j >> 2);
    const x0 = mid + 1 - (w >> 1);
    s.hl(g1, x0, 4 + j, w);
    s.px(g2, x0, 4 + j);
    s.px(g0, x0 + w - 2, 4 + j);
    s.px(g0, x0 + w - 3, 4 + j);
  }
  s.vl(d, mid + 1, 4, 10);
  s.vl(c, mid - 2, 4, 10);
  s.vl(c, mid + 4, 4, 10);
  s.use(6, 3.5);
  tube(s, 'iron', mid - 3, 14, 8, 2);
  s.hl(a, mid - 3, 14, 8);
  tube(s, 'iron', mid - 1, 16, 4, 2);
  const o = addMargin(s);
  o.finish();
  return o;
}

export function bench(): S {
  const [a, b, c, d] = R.wood;
  const [i0, i1, i2] = R.iron;
  const s = new S(34, 16);
  s.use(1, 1);
  for (const y of [0, 4, 8]) {
    s.rect(b, 2, y, 30, 3);
    s.hl(a, 2, y, 30);
    s.hl(d, 2, y + 2, 30);
    s.vl(c, 2, y, 2);
    for (let x = 6; x < 30; x += 7) s.hl(c, x, y + 1, 3);
  }
  s.use(2, 2);
  for (const x of [4, 27]) {
    s.rect(i1, x, 0, 3, 16);
    s.vl(i0, x + 2, 0, 16);
    s.vl(i2, x, 0, 16);
    s.rect(i2, x - 1, 15, 5, 1);
    for (const y of [2, 6, 10]) s.px(R.pole[0], x + 1, y);
  }
  s.use(3, 1.5);
  s.rect(i2, 2, 12, 30, 1);
  const o = addMargin(s);
  o.finish();
  return o;
}

/** A Dutch city bike at the same size and with the same tyre and rim as the rider's bike. */
export function bike(col = 'navy'): S {
  const [a, b, c] = R[col];
  const [t0, t1, t2] = R.pole;
  const W = 40;
  const H = 27;
  const s = new S(W, H);
  const wr = 7;
  const cy = H - wr - 1;
  for (const cx of [8, 31]) {
    s.use(10 + cx, 2);
    for (let ang = 0; ang < 360; ang += 2) {
      const ca = Math.cos((ang * Math.PI) / 180);
      const sa = Math.sin((ang * Math.PI) / 180);
      s.px(R.hull[3], pyRound(cx + ca * wr), pyRound(cy + sa * wr));
      s.px(R.hull[2], pyRound(cx + ca * (wr - 1)), pyRound(cy + sa * (wr - 1)));
      s.px(!(ang < 330 && ang > 200) ? t2 : t0, pyRound(cx + ca * (wr - 2)), pyRound(cy + sa * (wr - 2)));
    }
    s.px(t0, cx, cy);
    s.px(t1, cx + 1, cy);
  }
  s.use(30, 3);
  const fr: ReadonlyArray<readonly [number, number, number, number]> = [
    [8, cy, 15, cy - 9],
    [15, cy - 9, 26, cy - 9],
    [15, cy - 9, 19, cy],
    [26, cy - 9, 19, cy],
    [26, cy - 9, 31, cy],
    [8, cy, 19, cy],
  ];
  for (const [x0, y0, x1, y1] of fr) s.line(b, x0, y0, x1, y1);
  for (const [x0, y0, x1, y1] of fr.slice(0, 2)) s.line(a, x0, y0 - 1, x1, y1 - 1);
  s.use(31, 3.5);
  s.grid(['hhhh.', '..hh.'], 12, cy - 14, { h: R.hull[3] });
  s.vl(b, 14, cy - 12, 3);
  s.vl(c, 27, cy - 14, 5);
  s.hl(R.hull[3], 26, cy - 15, 5);
  s.use(32, 3.5);
  s.rect(R.wood[1], 28, cy - 18, 7, 3);
  s.hl(R.wood[0], 28, cy - 18, 7);
  s.vl(R.wood[2], 28, cy - 17, 2);
  s.px(R.glow[1], 34, cy - 14);
  s.use(33, 3.5);
  s.rect(R.dred[1], 4, cy - 9, 8, 4);
  s.hl(R.dred[0], 4, cy - 9, 8);
  s.vl(R.dred[2], 4, cy - 9, 4);
  s.ell(t1, 19, cy, 2, 2);
  s.px(t0, 20, cy - 1);
  const o = addMargin(s);
  o.finish();
  return o;
}

/** A wooden planter: the box and its tulip frames, hard little clusters that nod one pixel. */
export function planter(): { box: S; tulips: S[] } {
  const [a, b, c, d] = R.wood;
  const W = 30;
  const s = new S(W, 10);
  s.use(1, 1);
  s.rect(b, 0, 2, W, 8);
  s.hl(a, 0, 2, W);
  s.hl(c, 0, 3, W);
  s.hl(d, 0, 9, W);
  for (let x = 4; x < W; x += 6) s.vl(c, x, 4, 5);
  s.vl(a, W - 1, 2, 8);
  s.vl(d, 0, 2, 8);
  s.rect(R.iron[1], 0, 2, 2, 8);
  s.rect(R.iron[1], W - 2, 2, 2, 8);
  const box = addMargin(s);
  box.finish();
  const tulips: S[] = [];
  for (let f = 0; f < 2; f++) {
    const o = new S(W, 12);
    const r = rngf(7);
    o.use(1, 1);
    for (let x = 1; x < W - 2; x += 2) {
      const h = r.int(4, 9);
      const lean = (x + f * 2) % 4 === 0 && f > 0;
      o.vl(R.leaf[1], x, 12 - h, h);
      if (r.random() < 0.5) o.px(R.leaf[0], x + 1, 12 - h + 2);
      const q = R[r.pick(['tulip', 'yellow', 'dred', 'cloth'])];
      const tx = x + (lean ? 1 : 0);
      o.grid(['ab', 'ba'], tx, 12 - h - 2, { a: q[0], b: q[1] });
    }
    const m = addMargin(o);
    m.finish();
    tulips.push(m);
  }
  return { box, tulips };
}

/** A flag waving in hard frames. `nl` or `city` (three crosses). */
export function flagFrames(kind: 'nl' | 'city' = 'nl', n = 6, fw = 28, fh = 18): S[] {
  const out: S[] = [];
  const bands = kind === 'nl' ? ['dred', 'white', 'navy'] : ['dred', 'hull', 'dred'];
  for (let f = 0; f < n; f++) {
    const s = new S(fw, fh + 6);
    s.use(1, 1);
    const ph = (f / n) * Math.PI * 2;
    for (let i = 0; i < fw; i++) {
      const q = i / fw;
      const w = Math.sin(i * 0.28 - ph);
      const yo = 3 + Math.trunc(pyRound(w * 2 * (0.2 + q)));
      const cosv = Math.cos(i * 0.28 - ph);
      const tone = cosv > 0.78 ? 0 : cosv > -0.4 ? 1 : 2;
      bands.forEach((m, bi) => {
        s.vl(R[m][tone], i, yo + Math.floor((bi * fh) / 3), Math.floor(fh / 3) + (bi === 2 ? 1 : 0));
      });
      if (kind === 'city') {
        for (const xi of [5, 13, 21]) {
          const d = Math.abs(i - xi);
          if (d <= 2) {
            s.px(R.xw[0], i, yo + (fh >> 1) - d);
            s.px(R.xw[0], i, yo + (fh >> 1) + d - 1);
          }
        }
      }
    }
    const o = addMargin(s);
    o.finish();
    out.push(o);
  }
  return out;
}

export function flagPole(h: number): S {
  const s = new S(4, h);
  s.use(1, 1);
  tube(s, 'pole', 1, 3, 2, h - 3);
  s.rect(R.brass[1], 0, 0, 4, 3);
  s.hl(R.brass[0], 1, 0, 3);
  s.px(R.brass[2], 0, 2);
  const o = addMargin(s);
  o.finish();
  return o;
}

export function crate(w = 22, h = 16): S {
  const [a, b, c, d] = R.wood;
  const tp = 4;
  const s = new S(w + tp, h + tp);
  s.use(1, 1);
  s.poly(a, [
    [0, tp],
    [tp, 0],
    [w + tp - 1, 0],
    [w - 1, tp],
  ]);
  s.use(2, 0.8);
  s.poly(c, [
    [w, tp],
    [w + tp - 1, 0],
    [w + tp - 1, h - 1],
    [w, h + tp - 1],
  ]);
  s.use(3, 2);
  s.rect(b, 0, tp, w, h);
  s.hl(a, 0, tp, w);
  s.hl(d, 0, tp + h - 1, w);
  s.vl(c, 0, tp, h);
  s.vl(a, w - 1, tp, h);
  for (let y = tp + 4; y < tp + h - 1; y += 4) s.hl(c, 1, y, w - 2);
  s.line(c, 2, tp + h - 3, w - 3, tp + 2);
  s.line(d, 2, tp + h - 2, w - 3, tp + 3);
  for (const [x, y] of [
    [1, tp + 1],
    [w - 2, tp + 1],
    [1, tp + h - 2],
    [w - 2, tp + h - 2],
  ]) {
    s.px(R.pole[1], x, y);
  }
  const o = addMargin(s);
  o.finish();
  return o;
}

/** A white wagon at the heroes' scale. Same outline, same tones as a hero's jacket. */
export function stand(label = 'HOTDOGS', stripe = 'dred'): S {
  const [w0, w1, w2] = R.white;
  const s = new S(84, 54);
  const y = 12;
  const w = 72;
  const h = 34;
  const x = 4;
  // The side face to the right is lit: the sun is on that side.
  s.use(1, 1);
  s.poly(w1, [
    [x + w, y],
    [x + w + 8, y - 3],
    [x + w + 8, y + h - 4],
    [x + w, y + h],
  ]);
  s.vl(w2, x + w, y, h);
  s.use(2, 2);
  s.rect(w0, x, y, w, h);
  s.vl(w1, x, y, h);
  s.vl(w1, x + 1, y, h);
  s.hl(w1, x, y + h - 5, w);
  s.hl(w2, x, y + h - 4, w);
  s.hl(w2, x, y + h - 1, w);
  for (let q = x + 4; q < x + 14; q += 4) s.vl(w1, q, y + 2, h - 8);
  // The hatch, the counter, what is on it.
  s.use(3, 3);
  s.rect(R.hull[3], x + 16, y + 6, 38, 16);
  s.hl(R.glow[1], x + 18, y + 8, 34);
  s.hl(R.glow[2], x + 18, y + 9, 34);
  for (const [q, m] of [
    [x + 20, 'dred'],
    [x + 24, 'yellow'],
    [x + 28, 'dgreen'],
  ] as const) {
    s.rect(R[m][1], q, y + 15, 3, 6);
    s.vl(R[m][0], q + 2, y + 15, 6);
    s.hl(R.cloth[0], q, y + 14, 3);
  }
  for (const q of [x + 33, x + 38, x + 43]) {
    s.rect(R.bricko[1], q, y + 18, 4, 3);
    s.hl(R.bricko[0], q + 1, y + 17, 3);
    s.hl(R.dred[1], q, y + 19, 4);
    s.hl(R.bricko[2], q, y + 20, 4);
  }
  for (let q = x + 19; q < x + 52; q += 4) {
    s.rect(R.brickb[1], q, y + 10, 2, 3);
    s.px(R.brickb[0], q + 1, y + 10);
  }
  s.use(4, 3.5);
  s.rect(R.wood[1], x + 14, y + 22, 42, 2);
  s.hl(R.wood[0], x + 14, y + 22, 42);
  s.hl(R.wood[3], x + 14, y + 24, 42);
  // The menu.
  s.use(5, 3);
  s.rect(R.cloth[0], x + 58, y + 6, 11, 15);
  s.hl(R.dred[1], x + 58, y + 6, 11);
  for (let j = 0; j < 3; j++) {
    s.hl(R.hull[3], x + 59, y + 9 + j * 3, 6);
    s.rect(R.dred[1], x + 66, y + 9 + j * 3, 2, 1);
  }
  // The small window on the other side.
  s.use(6, 3);
  s.rect(R.glass[2], x + 5, y + 6, 8, 10);
  s.hl(R.glass[3], x + 5, y + 6, 8);
  s.line(R.glass[0], x + 11, y + 7, x + 8, y + 12);
  s.line(R.glass[1], x + 12, y + 8, x + 9, y + 14);
  // The name.
  text(s, label, x + ((w - textW(label)) >> 1), y + 26, R.navy[2]);
  s.use(7, 2.5);
  s.hl(R[stripe][1], x, y + h - 3, w);
  // The awning: stripes, a lit top, a scalloped hem.
  s.use(8, 4);
  s.poly(R.white[0], [
    [x - 3, y],
    [x + 5, y - 8],
    [x + w + 11, y - 8],
    [x + w + 4, y],
  ]);
  const [, sb, sc, sd] = R[stripe];
  for (let i = 0; i < w + 8; i += 8) {
    s.poly(sb, [
      [x - 3 + i, y],
      [x + 5 + i, y - 8],
      [x + 9 + i, y - 8],
      [x + 1 + i, y],
    ]);
  }
  s.hl(R.white[1], x - 3, y, w + 8);
  for (let i = 0; i < w + 6; i += 8) {
    s.rect(sb, x - 3 + i, y + 1, 4, 3);
    s.hl(sd, x - 3 + i, y + 4, 4);
    s.hl(sc, x - 3 + i, y + 3, 4);
    s.rect(R.white[0], x + 1 + i, y + 1, 4, 3);
    s.hl(R.white[2], x + 1 + i, y + 4, 4);
    s.hl(R.white[1], x + 1 + i, y + 3, 4);
  }
  // Wheels.
  for (const wx of [x + 14, x + 56]) {
    s.use(9, 5);
    s.ell(R.hull[3], wx, y + h + 1, 7, 7);
    s.ell(R.hull[2], wx, y + h + 1, 6, 6);
    s.ell(R.pole[1], wx, y + h + 1, 3, 3);
    s.px(R.pole[0], wx + 1, y + h);
    s.px(R.pole[3], wx, y + h + 1);
    s.px(R.pole[2], wx - 1, y + h + 2);
  }
  s.use(10, 1.5);
  s.rect(R.pole[1], 0, y + h - 1, 5, 2);
  s.hl(R.pole[0], 0, y + h - 1, 5);
  s.rect(R.pole[2], 0, y + h + 1, 2, 7);
  const o = addMargin(s);
  o.finish();
  return o;
}

/** A flea market stall: striped awning, goods on a table. Returns the stall and its hanging cloth frames. */
export function stall(w: number, seed: number, cloth: readonly [string, string] = ['dred', 'white']): { box: S; cloth: S[] } {
  const r = rngf(seed);
  const H = 50;
  const s = new S(w + 6, H);
  const y0 = 10;
  const x = 3;
  for (const a of [x + 1, x + w - 3]) {
    s.use(1, 1);
    tube(s, 'pole', a, y0, 2, H - y0);
  }
  s.use(2, 1.2);
  s.rect(R.hull[3], x + 1, y0, w - 2, 3);
  // The goods.
  s.use(3, 2);
  let gx = x + 3;
  const tb = H - 15;
  while (gx < x + w - 8) {
    const k = r.int(0, 5);
    if (k === 0) {
      const cnt = r.int(2, 5);
      for (let j = 0; j < cnt; j++) {
        const c = R[r.pick(['navy', 'dred', 'dgreen', 'bricko'])];
        s.hl(c[1], gx, tb - 2 - j * 2, 9);
        s.hl(c[2], gx, tb - 1 - j * 2, 9);
        s.px(R.cloth[0], gx + 8, tb - 2 - j * 2);
      }
      gx += 11;
    } else if (k === 1) {
      const br = R.brass;
      s.rect(br[1], gx + 2, tb - 9, 2, 9);
      s.vl(br[0], gx + 3, tb - 9, 9);
      s.vl(br[2], gx + 2, tb - 9, 9);
      s.ell(br[1], gx + 2.5, tb - 11, 3.5, 2.5);
      s.px(br[0], gx + 4, tb - 12);
      s.hl(br[2], gx - 1, tb - 1, 7);
      gx += 10;
    } else if (k === 2) {
      const w_ = R.wood;
      s.rect(w_[1], gx, tb - 6, 9, 6);
      s.hl(w_[0], gx, tb - 6, 9);
      s.hl(w_[2], gx, tb - 3, 9);
      s.vl(w_[3], gx, tb - 6, 6);
      gx += 11;
    } else if (k === 3) {
      const g = R.glass;
      const w_ = R.wood;
      s.rect(g[2], gx, tb - 10, 8, 9);
      s.rect(w_[1], gx - 1, tb - 11, 10, 1);
      s.rect(w_[2], gx - 1, tb - 1, 10, 1);
      s.vl(w_[1], gx - 1, tb - 11, 11);
      s.vl(w_[0], gx + 8, tb - 11, 11);
      s.line(g[0], gx + 6, tb - 9, gx + 3, tb - 4);
      gx += 11;
    } else {
      const bl = R.blue;
      s.ell(bl[1], gx + 3, tb - 4, 3, 4);
      s.vl(bl[0], gx + 5, tb - 7, 5);
      s.vl(bl[2], gx + 1, tb - 6, 4);
      s.hl(bl[0], gx + 1, tb - 9, 5);
      gx += 8;
    }
  }
  // The table.
  s.use(4, 3);
  const w_ = R.wood;
  s.rect(w_[1], x, tb, w, 2);
  s.hl(w_[0], x, tb, w);
  s.hl(w_[3], x, tb + 2, w);
  const [, c1, c2] = R.cloth;
  s.rect(c1, x + 1, tb + 3, w - 2, 5);
  for (let q = x + 1; q < x + w - 1; q += 4) s.vl(c2, q, tb + 3, 5);
  s.hl(c2, x + 1, tb + 7, w - 2);
  for (const a of [x + 3, x + w - 5]) s.rect(w_[2], a, tb + 8, 2, 7);
  // The awning.
  s.use(5, 4);
  for (let i = -3; i < w + 3; i++) {
    const c = R[cloth[Math.floor((i + 3) / 7) % 2]];
    s.vl((i + 3) % 7 >= 2 ? c[0] : c[1], x + i, y0 - 9, 8);
    s.vl(c[1], x + i, y0 - 1, 1);
    s.vl(c[2], x + i, y0, 2);
    if ([2, 3, 4].includes((i + 3) % 7)) s.px(c[1], x + i, y0 + 2);
  }
  const box = addMargin(s);
  box.finish();
  const fr: S[] = [];
  for (let f = 0; f < 2; f++) {
    const o = new S(w, 14);
    const r2 = rngf(seed + 3);
    o.use(1, 1);
    for (let q = 5; q < w - 5; q += 11) {
      const c = R[r2.pick(['dred', 'navy', 'plastg', 'bricko'])];
      const lean = f && q % 2 ? 1 : 0;
      o.rect(c[1], q, 2, 5, 4);
      o.rect(c[1], q + lean, 6, 5, 6);
      o.vl(c[0], q + 4, 2, 4);
      o.vl(c[0], q + 4 + lean, 6, 6);
      o.vl(c[2], q, 2, 4);
      o.vl(c[2], q + lean, 6, 6);
      o.hl(c[3], q + lean, 11, 5);
      o.vl(R.hull[3], q + 2, 0, 2);
    }
    const m = addMargin(o);
    m.finish();
    fr.push(m);
  }
  return { box, cloth: fr };
}

/** A houseboat at the heroes' scale: hull, deck, plank cabin with a side face, roof garden. Returns the chimney spot too. */
export function houseboat(w: number, seed: number, wall = 'plastg', roof = 'roof', outline = K): { box: S; chimney: readonly [number, number] } {
  const r = rngf(seed);
  const hullH = 15;
  const dp = 8;
  const sd = 9;
  const ch = 36;
  const H = dp + ch + 26 + hullH;
  const [a, b, c, d] = R[wall];
  const s = new S(w + sd + 4, H);
  const dy = H - hullH;
  s.use(1, 1);
  const [h0, h1, h2, h3] = R.hull;
  s.rect(h2, 0, dy, w, hullH);
  s.hl(h0, 0, dy, w);
  s.hl(h1, 0, dy + 1, w);
  s.hl(h3, 0, dy + 2, w);
  s.rect(h3, 0, dy + hullH - 3, w, 3);
  for (let x = 8; x < w; x += 26) {
    s.ell(h3, x, dy + 8, 2, 2);
    s.px(h0, x + 1, dy + 7);
  }
  const sc = Math.floor(w / 7);
  for (let q = 0; q < sc; q++) {
    const x = r.int(0, w);
    const y = r.int(dy + 4, dy + hullH - 4);
    const t = r.random() < 0.5 ? h1 : h3;
    s.hl(t, x, y, r.int(2, 6));
  }
  s.use(2, 1.5);
  const W_ = R.wood;
  s.poly(W_[1], [
    [dp, dy - dp],
    [w - dp, dy - dp],
    [w - 1, dy - 1],
    [0, dy - 1],
  ]);
  for (let j = dy - dp; j < dy; j += 2) s.hl(W_[2], 2, j, w - 4);
  const cx = dp + 3;
  const cw = w - 2 * dp - 10;
  const top = dy - dp - ch;
  s.use(3, 1.8);
  s.poly(a, [
    [cx + cw, top],
    [cx + cw + sd - 1, top - 4],
    [cx + cw + sd - 1, dy - dp - 4],
    [cx + cw, dy - dp],
  ]);
  for (let j = top; j < dy - dp; j += 4) s.line(b, cx + cw, j, cx + cw + sd - 1, j - 4);
  s.use(4, 2);
  s.rect(b, cx, top, cw, ch);
  for (let j = top + 3; j < dy - dp; j += 4) {
    s.hl(c, cx, j, cw);
    s.hl(a, cx + Math.trunc(cw * 0.55), j + 1, Math.trunc(cw * 0.45));
  }
  s.vl(d, cx, top, ch);
  s.vl(c, cx + 1, top, ch);
  const nw = Math.max(2, Math.floor((cw - 8) / 20));
  const gap = (cw - nw * 14) / (nw + 1);
  for (let i = 0; i < nw; i++) {
    const wx = Math.trunc(cx + gap + i * (14 + gap));
    window_(s, wx, top + 8, 14, 15, r, 30 + i * 2, { z: 3, kind: i % 3 });
    s.use(50 + i, 3.8);
    s.rect(W_[1], wx - 1, top + 24, 16, 3);
    s.hl(W_[0], wx - 1, top + 24, 16);
    s.hl(W_[3], wx - 1, top + 27, 16);
    for (let q = wx; q < wx + 14; q += 2) {
      const cc = R[r.pick(['tulip', 'yellow', 'dred', 'cloth'])];
      s.rect(cc[1], q, top + 22, 2, 2);
      s.px(cc[0], q + 1, top + 22);
      s.px(R.leaf[1], q, top + 23);
    }
  }
  const rm = R[roof];
  s.use(5, 4);
  s.poly(rm[1], [
    [cx - 3, top],
    [cx + 6, top - 7],
    [cx + cw + sd + 3, top - 7],
    [cx + cw + 3, top],
  ]);
  s.hl(rm[0], cx + 6, top - 7, cw + sd - 3);
  s.hl(rm[2], cx - 3, top, cw + 6);
  s.hl(rm[3], cx - 3, top + 1, cw + 6);
  s.use(6, 4.5);
  const chx = cx + cw - 14;
  tube(s, 'iron', chx, top - 18, 5, 12);
  s.rect(R.iron[2], chx - 1, top - 19, 7, 2);
  s.hl(R.iron[0], chx, top - 19, 6);
  for (let q = cx + 6; q < cx + Math.trunc(cw * 0.45); q += 9) {
    s.use(60 + q, 4.5);
    for (let n = 0; n < 16; n++) {
      const xx = q + r.int(-5, 5);
      const yy = top - 4 - r.int(0, 7);
      const l = (xx - q) * 0.1 + (top - 4 - yy) * 0.14;
      const tone = l > 0.8 ? R.leaf[0] : l > 0.3 ? R.leaf[1] : R.leaf[2];
      for (const [dx, dy2] of STAMPS[r.int(0, 5)]) s.px(tone, xx + dx, yy + dy2);
    }
  }
  // A lifebuoy.
  s.use(70, 3.5);
  const lx = cx + 6;
  const ly = top + 5;
  s.ell(R.dred[1], lx, ly, 3, 3);
  s.ell(R.white[0], lx, ly, 2, 2);
  s.px(R.dred[1], lx - 2, ly);
  s.px(R.dred[1], lx + 2, ly);
  s.rect(c, lx - 1, ly - 1, 2, 2);
  const box = addMargin(s);
  box.finish(outline);
  return { box, chimney: [cx + cw - 12, top - 19] };
}

export function smokeFrames(n = 8): S[] {
  const out: S[] = [];
  const [a, b, c] = R.cloth;
  for (let f = 0; f < n; f++) {
    const s = new S(13, 26);
    s.use(1, 1);
    for (let p = 0; p < 3; p++) {
      const q = (f / n + p / 3) % 1;
      const y = 23 - q * 21;
      const x = 6 + Math.sin(q * 5 + p) * (q * 3);
      const rr = 0.8 + q * 2.2;
      s.ell(q < 0.6 ? c : b, x, y, rr, rr * 0.9);
      s.px(a, x + rr * 0.4, y - rr * 0.4);
    }
    s.finish(0);
    out.push(s);
  }
  return out;
}

/** A small far cyclist. Same technique, but the thin parts cast no outline, so the wheels stay open. */
export function farCyclist(col = 'navy', n = 4): S[] {
  const out: S[] = [];
  for (let f = 0; f < n; f++) {
    const s = new S(18, 16);
    s.use(1, 1);
    for (const cx of [3, 14]) {
      for (let ang = 0; ang < 360; ang += 10) {
        s.px(R.hull[3], pyRound(cx + Math.cos((ang * Math.PI) / 180) * 3), pyRound(12 + Math.sin((ang * Math.PI) / 180) * 3));
      }
      s.px(R.pole[1], cx, 12);
    }
    s.use(2, 2);
    s.line(R.pole[2], 3, 12, 8, 9);
    s.line(R.pole[2], 8, 9, 13, 9);
    s.line(R.pole[2], 13, 9, 14, 12);
    s.line(R.pole[2], 8, 9, 9, 12);
    for (let i = 0; i < s.c.length; i++) s.thin[i] = s.c[i] > 0 ? 1 : 0;
    s.use(3, 3);
    s.rect(R[col][1], 7, 3, 3, 6);
    s.vl(R[col][0], 9, 3, 5);
    s.line(R[col][2], 9, 4, 13, 7);
    s.rect(R.skin[1], 8, 0, 3, 3);
    s.px(R.skin[0], 10, 0);
    s.hl(R.hull[2], 8, 0, 2);
    const a = (f / n) * Math.PI * 2;
    s.line(R.hull[2], 8, 9, Math.trunc(pyRound(9 + Math.cos(a) * 1.8)), Math.trunc(pyRound(12 + Math.sin(a) * 1.8)));
    for (let i = 0; i < s.c.length; i++) if (s.p[i] === 3) s.thin[i] = 0;
    const o = addMargin(s);
    o.finish(KM);
    out.push(o);
  }
  return out;
}

/** A flat glass canal boat, faces right. */
export function tourboat(): S {
  const s = new S(78, 15);
  s.use(1, 1);
  const [n0, n1, n2, n3] = R.navy;
  const [w0, w1] = R.white;
  const g = R.glass;
  s.poly(n1, [
    [0, 8],
    [74, 8],
    [70, 13],
    [3, 13],
  ]);
  s.hl(n0, 0, 8, 74);
  s.hl(w0, 0, 10, 73);
  s.hl(n3, 3, 13, 67);
  s.hl(n2, 2, 12, 69);
  s.use(2, 2);
  s.rect(g[2], 4, 3, 62, 5);
  for (let x = 4; x < 66; x += 7) s.vl(w1, x, 3, 5);
  for (const x of [8, 22, 43, 57]) s.line(g[0], x + 2, 3, x, 7);
  s.hl(g[1], 4, 3, 62);
  s.use(3, 3);
  s.rect(w0, 2, 1, 66, 2);
  s.hl(w1, 2, 2, 66);
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** A city waste container: grey-green with a slot and a shield with three crosses. */
export function wasteBin(): S {
  const [a, b, c, d] = R.iron;
  const s = new S(18, 30);
  s.use(1, 1);
  s.rect(b, 1, 3, 16, 27);
  s.vl(a, 15, 3, 27);
  s.vl(a, 14, 3, 27);
  s.vl(c, 1, 3, 27);
  s.hl(d, 1, 29, 16);
  s.poly(b, [
    [1, 3],
    [4, 0],
    [13, 0],
    [16, 3],
  ]);
  s.hl(a, 4, 0, 10);
  s.hl(d, 1, 3, 16);
  s.use(2, 2);
  s.rect(R.hull[3], 5, 7, 8, 3);
  s.hl(R.pole[1], 5, 6, 8);
  s.rect(R.dred[1], 6, 14, 6, 8);
  s.hl(R.dred[0], 6, 14, 6);
  s.vl(R.dred[2], 6, 14, 8);
  for (const q of [15, 18]) {
    s.px(R.xw[0], 8, q);
    s.px(R.xw[0], 10, q);
    s.px(R.xw[0], 9, q + 1);
  }
  const o = addMargin(s);
  o.finish();
  return o;
}

/** A row of iron hoops. */
export function bikeRack(n = 3): S {
  const s = new S(n * 9 + 2, 12);
  s.use(1, 1);
  const [a, b, c] = R.pole;
  for (let i = 0; i < n; i++) {
    const x = 1 + i * 9;
    s.vl(b, x, 2, 10);
    s.vl(a, x + 6, 2, 10);
    s.hl(a, x + 1, 0, 5);
    s.px(b, x + 1, 1);
    s.px(a, x + 5, 1);
  }
  s.hl(c, 0, 11, n * 9 + 2);
  const o = addMargin(s);
  o.finish();
  return o;
}
