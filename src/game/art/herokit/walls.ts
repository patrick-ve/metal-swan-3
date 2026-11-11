/** Walls, windows, doors, gables and the canal house: each drawn like a hero part (docs/design/ams2.md §1.1). */
import { addMargin, kitTier, type Pts, rectMask, S } from './canvas';
import { pyRound } from './canvas-math';
import { K, KM, R } from './palette';
import { type KitRng, rngf } from './rng';

/** Brick by hint, as a hero's cloth is drawn: a few short course lines and lit bricks, in clusters, never a full pattern. */
export function brickHints(s: S, k: Uint8Array, mat: string, seed: number): void {
  const r = rngf(seed);
  const [hi, ba, sh] = R[mat];
  let y0 = Infinity;
  let y1 = -1;
  let x0 = Infinity;
  let x1 = -1;
  for (let i = 0; i < k.length; i++) {
    if (!k[i]) continue;
    const y = Math.floor(i / s.w);
    const x = i - y * s.w;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
  }
  if (y1 < 0) return;
  const W = x1 - x0 + 1;
  const on = (y: number, x: number): boolean => y >= 0 && y < s.h && x >= 0 && x < s.w && k[y * s.w + x] === 1 && s.c[y * s.w + x] === ba;
  // Clusters: patches of the wall carry bricks, the rest stays calm.
  const nPatch = Math.max(3, Math.trunc(((y1 - y0) * W) / 115));
  for (let p = 0; p < nPatch; p++) {
    const cx = x0 + r.int(0, W);
    const cy = y0 + r.int(0, y1 - y0 + 1);
    const rows = r.int(2, 5);
    for (let row = 0; row < rows; row++) {
      const y = cy + row * 3;
      const off = (row % 2) * 3;
      const bricks = r.int(1, 4);
      for (let b = 0; b < bricks; b++) {
        const x = cx + off + b * 7 - r.int(0, 3);
        const L = r.int(4, 7);
        for (let i = 0; i < L; i++) if (on(y, x + i)) s.c[y * s.w + x + i] = sh;
        if (x + L < s.w) {
          const xx = Math.min(x + L, s.w - 1);
          if (on(y - 1, xx)) s.c[(y - 1) * s.w + xx] = sh;
        }
        // The top of the brick above catches the light on the right half of the wall.
        if (x > x0 + W * 0.45 && r.random() < 0.55) {
          const n = r.int(2, 5);
          for (let i = 0; i < n; i++) if (on(y - 2, x + i + 1)) s.c[(y - 2) * s.w + x + i + 1] = hi;
        }
      }
    }
  }
}

export function plasterHints(s: S, k: Uint8Array, mat: string, seed: number): void {
  const r = rngf(seed);
  const [hi, ba, sh] = R[mat];
  let y0 = Infinity;
  let y1 = -1;
  let x0 = Infinity;
  let x1 = -1;
  for (let i = 0; i < k.length; i++) {
    if (!k[i]) continue;
    const y = Math.floor(i / s.w);
    const x = i - y * s.w;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
  }
  if (y1 < 0) return;
  const on = (y: number, x: number): boolean => y >= 0 && y < s.h && x >= 0 && x < s.w && k[y * s.w + x] === 1 && s.c[y * s.w + x] === ba;
  const n = Math.max(2, Math.trunc(((y1 - y0) * (x1 - x0)) / 420));
  for (let q = 0; q < n; q++) {
    const x = x0 + r.int(0, x1 - x0 + 1);
    const y = y0 + r.int(0, y1 - y0 + 1);
    const L = r.int(3, 8);
    const tone = x < (x0 + x1) / 2 ? sh : hi;
    for (let i = 0; i < L; i++) if (on(y, x + i)) s.c[y * s.w + x + i] = tone;
    if (r.random() < 0.5) {
      const m = Math.max(1, L - 2);
      for (let i = 0; i < m; i++) if (on(y + 1, x + i + 1)) s.c[(y + 1) * s.w + x + i + 1] = tone;
    }
  }
}

export interface WindowOpts {
  z?: number;
  kind?: number;
  arch?: boolean;
  lit?: boolean;
  trim?: string;
}

/** A window as a small sprite: a white frame with a lit top and right edge, deep glass, one bright reflection, one thing inside. */
export function window_(s: S, x: number, y: number, w: number, h: number, r: KitRng, part: number, o: WindowOpts = {}): void {
  const z = o.z ?? 3;
  const [t0, t1, t2] = R[o.trim ?? 'white'];
  const [g0, g1, g2, g3] = R.glass;
  s.marks.push(['win', Math.trunc(x), Math.trunc(y), Math.trunc(w), Math.trunc(h)]);
  s.use(part, z);
  s.rect(t1, x, y, w, h);
  s.hl(t0, x, y, w);
  s.vl(t0, x + w - 1, y, h);
  s.vl(t2, x, y + 1, h - 1);
  s.hl(t2, x, y + h - 1, w - 1);
  const gx = x + 1;
  const gy = y + 1;
  const gw = w - 2;
  const gh = h - 2;
  if (o.lit) {
    const [l0, l1, l2] = R.lit;
    s.rect(l1, gx, gy, gw, gh);
    s.hl(l2, gx, gy, gw);
    s.rect(l0, gx + (gw >> 1), gy + Math.floor(gh / 3), Math.max(1, Math.floor(gw / 3)), Math.max(1, Math.floor(gh / 3)));
  } else {
    s.rect(g2, gx, gy, gw, gh);
    s.hl(g3, gx, gy, gw);
    s.vl(g3, gx, gy, gh);
    // One reflection: a slanted bright cluster, upper right.
    const n = Math.max(2, gh >> 1);
    for (let j = 0; j < n; j++) {
      const cnt = Math.max(1, Math.floor(gw / 3));
      for (let q = 0; q < cnt; q++) {
        const xx = gx + gw - 1 - (j >> 1) - q - r.int(0, 1);
        if (gx < xx && xx < gx + gw) s.px(q ? g1 : g0, xx, gy + 1 + j);
      }
    }
    const k = o.kind !== undefined ? o.kind : r.int(0, 6);
    if (gh >= 8 && gw >= 3) {
      const [c0, c1, c2] = R.cloth;
      if (k === 0) {
        // Curtains.
        const cw = Math.max(1, Math.floor(gw / 3));
        s.rect(c1, gx, gy, cw, (gh >> 1) + 1);
        s.rect(c0, gx + gw - cw, gy, cw, (gh >> 1) + 1);
        s.px(c2, gx, gy + (gh >> 1) + 1);
        s.px(c1, gx + gw - 1, gy + (gh >> 1) + 1);
      } else if (k === 1) {
        // A plant on the sill.
        const px = gx + (gw >> 1) - 1;
        s.rect(R.dred[1], px, gy + gh - 2, 2, 2);
        s.rect(R.leaf[1], px - 1, gy + gh - 4, 3, 2);
        s.px(R.leaf[0], px + 1, gy + gh - 4);
        s.px(R.leaf[2], px - 1, gy + gh - 3);
      } else if (k === 2) {
        // A blind half down.
        const d = Math.floor(gh / 3) + 1;
        s.rect(c1, gx, gy, gw, d);
        s.hl(c2, gx, gy + d - 1, gw);
        s.hl(c0, gx, gy, gw);
      } else if (k === 3 && gh >= 10) {
        // A lamp in the room.
        s.px(R.glow[1], gx + (gw >> 1), gy + Math.floor(gh / 3));
        s.px(R.glow[0], gx + (gw >> 1), gy + Math.floor(gh / 3) + 1);
      }
    }
  }
  // Bars.
  if (w >= 8) s.vl(t1, x + (w >> 1), y + 1, h - 2);
  if (h >= 10) {
    s.hl(t1, x + 1, y + (h >> 1), w - 2);
    s.hl(t0, x + 1, y + (h >> 1), w - 2);
  }
  if (o.arch) {
    const ah = Math.max(2, Math.floor(w / 3));
    for (let i = 0; i < w; i++) {
      const u = ((i + 0.5) / w) * 2 - 1;
      const q = Math.trunc(pyRound((1 - Math.sqrt(Math.max(1 - u * u, 0))) * ah));
      s.rect(i > w / 2 ? t0 : t1, x + i, y - ah + q, 1, ah - q);
    }
    s.rect(g1, x + (w >> 1) - 1, y - ah + 2, 2, Math.max(1, ah - 2));
  }
  // The sill and the shadow it throws to the lower left.
  s.use(part + 1, z + 0.5);
  s.hl(t0, x - 1, y + h, w + 2);
  s.use(1, 1);
}

export function door(s: S, x: number, y: number, w: number, h: number, mat: string, _r: KitRng, part: number, z = 3, steps = 2): void {
  const [a, b, c, d] = R[mat];
  const [t0, t1, t2] = R.white;
  s.use(part, z);
  s.rect(t1, x - 1, y - 1, w + 2, h + 1);
  s.hl(t0, x - 1, y - 1, w + 2);
  s.vl(t0, x + w, y - 1, h + 1);
  s.vl(t2, x - 1, y, h);
  s.rect(b, x, y, w, h);
  s.vl(a, x + w - 1, y, h);
  s.vl(c, x, y, h);
  const tw = Math.max(2, Math.floor(h / 6));
  if (w >= 7) {
    const g = R.glass;
    s.rect(g[2], x + 1, y + 1, w - 2, tw);
    s.px(g[0], x + w - 2, y + 1);
    s.px(g[1], x + w - 3, y + 1);
    s.hl(t1, x, y + tw + 1, w);
    const py = y + tw + 3;
    const ph = Math.floor((h - tw - 5) / 2);
    for (let q = 0; q < 2; q++) {
      const yy = py + q * (ph + 1);
      s.rect(c, x + 2, yy, w - 4, ph);
      s.hl(d, x + 2, yy, w - 4);
      s.vl(a, x + w - 3, yy, ph);
    }
    s.px(R.brass[0], x + 1, y + (h >> 1) + 1);
    s.px(R.brass[1], x + 1, y + (h >> 1) + 2);
  }
  if (steps) {
    const [p0, , p2] = R.stone;
    s.use(part + 1, z + 0.5);
    for (let i = 0; i < steps; i++) {
      s.hl(p0, x - 2 - i, y + h + i, w + 4 + 2 * i);
      s.px(p2, x - 2 - i, y + h + i);
    }
  }
  s.use(1, 1);
}

export type GableKind = 'step' | 'neck' | 'bell' | 'spout' | 'flat';

export function gablePts(kind: GableKind, w: number, gh: number): Pts {
  const hw = w / 2;
  const mirror = (P: Array<readonly [number, number]>): Pts => [...P.map(([a, y]) => [hw - a, y] as const), ...[...P].reverse().map(([a, y]) => [hw + a - 1, y] as const)];
  if (kind === 'step') {
    const n = w >= 34 ? 4 : 3;
    const P: Array<readonly [number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = hw * (1 - (i / n) * 0.8);
      const y0 = gh * (1 - i / n);
      const y1 = gh * (1 - (i + 1) / n);
      P.push([a, y0], [a, y1]);
    }
    P.push([hw * 0.2, 0]);
    return mirror(P);
  }
  if (kind === 'neck') {
    const P: Array<readonly [number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      P.push([hw + (hw * 0.46 - hw) * (t * t * (3 - 2 * t)), gh - gh * 0.45 * t + Math.sin(t * Math.PI) * gh * 0.05]);
    }
    P.push([hw * 0.46, gh * 0.2], [hw * 0.2, 0]);
    return mirror(P);
  }
  if (kind === 'bell') {
    const P: Array<readonly [number, number]> = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      P.push([Math.max(hw * (1 - t) ** 0.55 * (0.62 + 0.38 * Math.cos(t * Math.PI * 2)), 0), gh * (1 - t)]);
    }
    return mirror(P);
  }
  if (kind === 'spout') {
    return [
      [0, gh],
      [hw - hw * 0.22, gh * 0.16],
      [hw - hw * 0.22, gh * 0.06],
      [hw, 0],
      [hw + hw * 0.22 - 1, gh * 0.06],
      [hw + hw * 0.22 - 1, gh * 0.16],
      [w - 1, gh],
    ];
  }
  return [
    [0, gh],
    [w - 1, gh],
  ];
}

export interface HouseOpts {
  sh?: number;
  ww?: number;
  wh?: number;
  gr?: number;
  gh?: number;
  side?: number;
  doorm?: string;
  plastered?: boolean;
  outline?: number;
  ground?: 'door' | 'none';
}

/** One canal house, as one sprite: wall, coping, cornice, windows, door, plinth. Outlined once. */
export function house(w: number, st: number, wall: string, gable: GableKind, seed: number, o: HouseOpts = {}): S {
  const sh = o.sh ?? 19;
  const ww = o.ww ?? 9;
  const wh = o.wh ?? 12;
  const gr = o.gr ?? 24;
  let gh = o.gh ?? 24;
  const side = o.side ?? 0;
  const doorm = o.doorm ?? 'dgreen';
  const plastered = o.plastered ?? false;
  const outline = o.outline ?? KM;
  const ground = o.ground ?? 'door';
  const r = rngf(seed);
  const [hi, ba, sd, dk] = R[wall];
  const [st0, st1, st2, st3] = R.stone;
  const [t0, t1, t2, t3] = R.white;
  if (gable === 'flat') gh = 10;
  const H = gh + st * sh + gr;
  const W = w + side;
  const s = new S(W, H);
  s.use(1, 1);
  const top = gh;
  const bot = H;
  if (side) {
    s.use(9, 0.4);
    const drop = Math.max(2, Math.floor(side / 3));
    s.poly(sd, [
      [w, top],
      [w + side - 1, top + drop],
      [w + side - 1, bot],
      [w, bot],
    ]);
    for (let i = top + 4; i < bot - 3; i += 3) if (i % 6 === 1) s.hl(dk, w + 1, i, side - 2);
    s.vl(dk, w, top, bot - top);
    // The roof slope behind the front.
    s.use(8, 0.3);
    s.poly(R.roof[1], [
      [w >> 1, top - gh * 0.55],
      [w + side * 0.25, top - gh * 0.05],
      [w + side - 1, top + drop - 1],
      [w, top],
    ]);
    s.use(10, 0.45);
    for (let j = 0; j < (side >> 1) + 1; j++) {
      for (let i = top - Math.trunc(gh * 0.1); i < top + drop - 1; i += 3) s.px(R.roof[2], w + j * 2, i);
    }
  }
  s.use(1, 1);
  // The wall.
  const fm = new Uint8Array(H * W);
  for (let y = top; y < bot; y++) for (let x = 0; x < w; x++) fm[y * W + x] = 1;
  if (gable !== 'flat') {
    const g = s.poly(ba, gablePts(gable, w, gh));
    for (let i = 0; i < fm.length; i++) if (g[i]) fm[i] = 1;
  }
  s.rect(ba, 0, top, w, bot - top);
  (plastered ? plasterHints : brickHints)(s, fm, wall, seed);
  // Light: a lit right edge, a shaded left side.
  const colMask = (test: (x: number) => boolean): Uint8Array => {
    const k = new Uint8Array(H * W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fm[y * W + x] && test(x)) k[y * W + x] = 1;
    return k;
  };
  s.retone(colMask((x) => x <= 1), [
    [ba, sd],
    [hi, ba],
  ]);
  s.retone(colMask((x) => x >= w - 1), [
    [ba, hi],
    [sd, ba],
  ]);
  // Under the cornice the wall falls into shadow, the coping is drawn on the top edge of the gable.
  if (gable !== 'flat') {
    const cap = new Uint8Array(H * W);
    const rgt = new Uint8Array(H * W);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!fm[i]) continue;
        const up = y > 0 && fm[i - W];
        const lf = x > 0 && fm[i - 1];
        const rg = x < W - 1 && fm[i + 1];
        const isCap = y > 0 ? !up : false;
        // At row 0 and column 0 the reference keeps the pixel's own value, so it is not an edge there.
        const isL = x > 0 ? !lf : false;
        const isR = x < W - 1 ? !rg : false;
        if ((isCap || isL || isR) && y < top) cap[i] = 1;
        if (isR) rgt[i] = 1;
      }
    }
    for (let i = 0; i < cap.length; i++) {
      if (!cap[i]) continue;
      s.c[i] = rgt[i] ? st0 : st1;
      s.p[i] = 4;
      s.z[i] = Math.fround(1.2);
    }
    // The second row under the coping is in shade.
    const under = new Uint8Array(H * W);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const above = cap[(y === 0 ? H - 1 : y - 1) * W + x];
        if (above && fm[i] && !cap[i]) under[i] = 1;
      }
    }
    s.retone(under, [
      [ba, sd],
      [hi, ba],
    ]);
    // A stone ball on the top; a hoisting beam and an attic window.
    s.use(5, 2);
    s.grid(['.ab.', 'abbc', '.bc.'], (w >> 1) - 2, 0, { a: t0, b: t1, c: t2 });
    s.use(1, 1);
    if (gh >= 18) {
      const aw = Math.max(5, ww - 2);
      const ah = Math.max(6, (wh >> 1) + 1);
      window_(s, (w - aw) >> 1, (gh >> 1) - 1, aw, ah, r, 30, { z: 3, kind: r.int(0, 4) });
      s.use(6, 2);
      const bx = (w >> 1) - 1;
      s.rect(R.bark[1], bx, (gh >> 1) - 5, 3, 3);
      s.hl(R.bark[0], bx, (gh >> 1) - 5, 3);
      s.hl(R.bark[3], bx, (gh >> 1) - 3, 3);
      s.px(K, bx + 1, (gh >> 1) - 2);
    }
  } else {
    const rm = R.roof;
    s.use(7, 0.5);
    s.poly(rm[1], [
      [0, top],
      [w * 0.1, 0],
      [w * 0.9, 0],
      [w - 1, top],
    ]);
    for (let j = 1; j < top; j += 3) {
      for (let i = 1 + (j % 2) * 3; i < w - 1; i += 7) {
        s.hl(rm[3], i, j, 3);
        s.hl(i > w / 2 ? rm[0] : rm[2], i + 3, j - 1, 2);
      }
    }
    s.hl(rm[0], Math.trunc(w * 0.1), 0, Math.trunc(w * 0.8));
    s.use(1, 1);
  }
  // The cornice, with brackets.
  s.use(11, 2);
  s.hl(t0, 0, top, w);
  s.hl(t1, 0, top + 1, w);
  s.hl(t3, 0, top + 2, w);
  for (let i = 2; i < w - 1; i += 5) s.px(t2, i, top + 2);
  s.use(1, 1);
  {
    const k = new Uint8Array(H * W);
    for (let y = top + 3; y <= top + 4 && y < H; y++) for (let x = 0; x < W; x++) if (fm[y * W + x]) k[y * W + x] = 1;
    s.retone(k, [
      [ba, sd],
      [hi, ba],
      [sd, dk],
    ]);
  }
  // Storeys.
  const n = Math.max(1, Math.floor((w - 4) / (ww + 4)));
  const gap = (w - n * ww) / (n + 1);
  for (let j = 0; j < st; j++) {
    const wy = top + 5 + j * sh;
    for (let i = 0; i < n; i++) {
      const wx = Math.trunc(pyRound(gap + i * (ww + gap)));
      // The frame's shadow on the wall, to the lower left.
      s.retone(rectMask(H, W, wx - 1, wy + 1, ww + 1, wh + 1), [
        [ba, sd],
        [hi, ba],
      ]);
      window_(s, wx, wy, ww, wh, r, 20 + i * 2 + j * 12, { z: 3, arch: seed % 4 === 1 });
      if (seed % 4 !== 1) {
        s.use(60 + i + j * 5, 2.5);
        s.hl(st0, wx - 1, wy - 2, ww + 2);
        s.hl(st2, wx - 1, wy - 1, ww + 2);
        s.use(1, 1);
      }
      if (r.random() < 0.3 && j < st - 1) {
        // A flower box.
        s.use(70 + i + j * 5, 4);
        s.rect(R.dgreen[1], wx, wy + wh + 1, ww, 2);
        s.hl(R.dgreen[0], wx, wy + wh + 1, ww);
        for (let q = wx; q < wx + ww; q += 2) {
          const c = R[r.pick(['tulip', 'yellow', 'dred'])];
          s.px(c[1], q, wy + wh);
          s.px(R.leaf[1], q + 1, wy + wh);
        }
        s.use(1, 1);
      }
    }
    if (j > 0 && seed % 3 === 0) {
      s.use(12 + j, 2);
      s.hl(st1, 0, top + j * sh + 2, w);
      s.hl(st3, 0, top + j * sh + 3, w);
      s.use(1, 1);
    }
  }
  // A downpipe.
  if (w >= 34) {
    s.use(80, 2);
    s.vl(R.pole[2], w - 3, top + 3, bot - top - 4);
    s.vl(R.pole[0], w - 2, top + 3, bot - top - 4);
    for (let q = top + 7; q < bot - 3; q += 9) s.hl(R.pole[3], w - 3, q, 2);
    s.use(1, 1);
  }
  // Ground floor.
  const gy = bot - gr;
  s.use(13, 2);
  s.hl(st0, 0, gy, w);
  s.hl(st2, 0, gy + 1, w);
  s.use(14, 2);
  s.rect(st1, 0, bot - 4, w, 4);
  s.hl(st0, 0, bot - 4, w);
  s.hl(st3, 0, bot - 1, w);
  for (let q = 5; q < w; q += 9) s.vl(st3, q, bot - 3, 2);
  s.use(1, 1);
  if (ground === 'door') {
    const dw = 9;
    const dh = gr - 6;
    const dx = n > 1 ? Math.trunc((w - dw) * (0.2 + r.random() * 0.12)) : (w - dw) >> 1;
    door(s, dx, bot - dh - 2, dw, dh, doorm, r, 90);
    if (n > 1) {
      const ww2 = ww + 1;
      window_(s, dx + dw + Math.max(2, (w - dx - dw - ww2) >> 1), gy + 4, ww2, wh, r, 92, { z: 3 });
    }
  }
  if (seed % 2 === 0 && gable !== 'flat' && gh >= 20) {
    // A gable stone.
    s.use(95, 3);
    const gw = 7;
    const ghh = 5;
    const gx = (w - gw) >> 1;
    const gyy = gh - ghh + 1;
    s.rect(t0, gx, gyy, gw, ghh);
    s.rect(R.blue[2], gx + 1, gyy + 1, gw - 2, ghh - 2);
    s.px(R.yellow[1], gx + 4, gyy + 1);
    s.hl(R.leaf[1], gx + 1, gyy + 3, gw - 2);
    s.use(1, 1);
  }
  if (kitTier() >= 2) facadeThings(s, w, top, bot, gr, st, sh, ww, wh, n, gap, seed, r, plastered);
  const out = addMargin(s);
  out.finish(outline);
  return out;
}

/** Small things on a house, each a hard little cluster: shutters, wall anchors, a door lamp, a number, a sign, pots. */
function facadeThings(s: S, w: number, top: number, bot: number, gr: number, st: number, sh: number, ww: number, wh: number, n: number, gap: number, seed: number, r: KitRng, plastered: boolean): void {
  // Shutters on the upper windows of some houses.
  if (seed % 3 === 2 && gap >= 5) {
    const col = R[['dgreen', 'navy', 'dred'][Math.floor(seed / 3) % 3]];
    for (let j = 0; j < st; j++) {
      const wy = top + 5 + j * sh;
      for (let i = 0; i < n; i++) {
        const wx = Math.trunc(pyRound(gap + i * (ww + gap)));
        s.use(200 + i + j * 7, 2.6);
        for (const sx of [wx - 3, wx + ww + 1]) {
          if (sx < 1 || sx + 2 >= w) continue;
          s.rect(col[1], sx, wy, 2, wh);
          s.vl(col[2], sx, wy, wh);
          s.hl(col[0], sx, wy, 2);
          for (let q = wy + 2; q < wy + wh - 1; q += 2) s.hl(col[3], sx, q, 2);
        }
      }
    }
  }
  // Wall anchors: little iron crosses on the storey lines.
  if (!plastered) {
    s.use(240, 2.7);
    for (let j = 0; j < st; j++) {
      const ay = top + 6 + j * sh + (wh >> 1);
      for (const sx of [2, w - 5]) {
        s.vl(K, sx, ay - 1, 3);
        s.hl(K, sx - 1, ay, 3);
      }
    }
  }
  // A door lamp, a number tile, a letter plate, a pot on the steps.
  s.use(250, 4);
  const fy = bot - gr;
  const lx = seed % 2 ? 3 : Math.max(3, w - 14);
  s.rect(R.hull[3], lx, fy + 7, 3, 1);
  s.rect(R.glow[1], lx, fy + 8, 3, 3);
  s.vl(R.glow[0], lx + 2, fy + 8, 3);
  s.hl(R.hull[3], lx, fy + 11, 3);
  s.use(251, 4);
  s.rect(R.navy[2], lx, fy + 13, 3, 2);
  s.px(R.xw[0], lx + 1, fy + 13);
  if (r.random() < 0.55) {
    s.use(252, 4);
    const px = lx + 4;
    s.rect(R.bricko[2], px, bot - 7, 3, 3);
    s.hl(R.bricko[0], px, bot - 7, 3);
    for (let i = 0; i < 6; i++) {
      const tone = R.leaf[r.int(0, 3)];
      const xx = px + r.int(-1, 4);
      const yy = bot - 8 - r.int(0, 3);
      s.px(tone, xx, yy);
    }
  }
  // A hanging sign on some ground floors.
  if (seed % 5 === 1 && w >= 40) {
    s.use(253, 4);
    const sx = w - 12;
    const sy = fy + 3;
    s.hl(K, sx, sy, 10);
    s.vl(K, sx + 2, sy, 2);
    s.vl(K, sx + 7, sy, 2);
    const cc = R[['dred', 'navy', 'dgreen', 'bricko', 'blue'][Math.floor(seed / 5) % 5]];
    s.rect(cc[1], sx, sy + 2, 10, 6);
    s.hl(cc[0], sx, sy + 2, 10);
    s.hl(cc[3], sx, sy + 7, 10);
    s.vl(cc[0], sx + 9, sy + 2, 6);
    s.hl(R.xw[0], sx + 2, sy + 4, 6);
  }
  // A street name plate on the corner.
  if (seed % 7 === 2) {
    s.use(254, 4);
    const sx = 3;
    const sy = fy + 3;
    s.rect(R.blue[2], sx, sy, 11, 4);
    s.hl(R.blue[0], sx, sy, 11);
    s.hl(R.xw[0], sx + 2, sy + 2, 7);
  }
}

