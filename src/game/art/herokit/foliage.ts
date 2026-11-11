/** Foliage: clumps of leaf clusters, like a hero's hair, and trunks like a hero's limb. */
import { addMargin, S } from './canvas';
import { pyRound } from './canvas-math';
import { K, R } from './palette';
import { rngf } from './rng';

export const STAMPS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, -1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, -1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
];

const TAU = Math.PI * 2;

type Clump = readonly [cx: number, cy: number, rr: number, ph: number];

function clumps(cw: number, ch: number, seed: number): Clump[] {
  const r = rngf(seed);
  const n = Math.trunc(8 + cw * 0.12);
  const out: Clump[] = [];
  for (let i = 0; i < n; i++) {
    const a = r.random() * TAU;
    const d = r.random() ** 0.6;
    const rr = (8 + r.random() * 9) * (cw / 100) ** 0.45 + 2;
    const ph = r.random() * TAU;
    out.push([cw / 2 + Math.cos(a) * d * cw * 0.36, ch * 0.48 + Math.sin(a) * d * ch * 0.34, rr, ph]);
  }
  // Upper left first: the nearer clumps sit lower and more to the sun.
  return out.sort((p, q) => p[1] - p[0] * 0.25 - (q[1] - q[0] * 0.25));
}

function crownBody(cw: number, ch: number, seed: number, frame: number, nFrames: number, mat: string, amp: number): S {
  const [hi, ba, sd, dk] = R[mat];
  const s = new S(cw, ch);
  clumps(cw, ch, seed).forEach(([cx, cy, rr, ph], i) => {
    const ox = Math.trunc(pyRound(Math.sin(ph + (frame / nFrames) * TAU) * amp * 0.75));
    const oy = Math.trunc(pyRound(Math.sin(ph * 1.7 + (frame / nFrames) * TAU) * amp * 0.45));
    s.use(10 + i, 1 + i * 0.5);
    const cx2 = cx + ox;
    const cy2 = cy + oy;
    const r1 = rngf(Math.trunc(seed * 7 + i * 13));
    // A rough clump: the disc plus a leafy edge, shaded in hard bands.
    const pts = Math.trunc(rr * rr * 1.05);
    s.ell(sd, cx2, cy2, rr, rr * 0.92);
    for (let q = 0; q < pts; q++) {
      const a = r1.random() * TAU;
      const d = Math.sqrt(r1.random());
      const ex = cx2 + Math.cos(a) * d * (rr + 1.6);
      const ey = cy2 + Math.sin(a) * d * (rr * 0.92 + 1.4);
      const lx = (ex - cx2) / rr;
      const ly = (ey - cy2) / rr;
      const l = lx * 0.55 - ly * 0.83 + (r1.random() - 0.5) * 0.34;
      const tone = l > 0.62 ? hi : l > 0.08 ? ba : l > -0.52 ? sd : dk;
      const st = STAMPS[r1.int(0, STAMPS.length)];
      for (const [dx, dy] of st) s.px(tone, Math.trunc(ex) + dx, Math.trunc(ey) + dy);
    }
  });
  return s;
}

/** A crown as one sprite. Frames move each clump by one pixel on its own phase: sprite animation, no smoothing. */
export function crown(cw: number, ch: number, seed: number, frame = 0, nFrames = 4, mat = 'leaf', amp = 1): S {
  const out = addMargin(crownBody(cw, ch, seed, frame, nFrames, mat, amp), 2);
  out.finish(K);
  return out;
}

/**
 * The frames of a crown in a light wind: one crown, the same in every frame, with a few leaf tufts that
 * show on its edge and a few leaf clusters inside that turn to the light, each in one frame of `nFrames`.
 * The texture stays where it is, so a crown never boils.
 */
export function swayCrown(cw: number, ch: number, seed: number, nFrames = 4, mat = 'leaf'): S[] {
  const [hi, ba, sd] = R[mat];
  const body = crownBody(cw, ch, seed, 0, nFrames, mat, 1);
  const m = 2;
  const W = cw + 2 * m;
  const H = ch + 2 * m;
  const filled = (x: number, y: number, o: S): boolean => x >= 0 && y >= 0 && x < W && y < H && o.c[y * W + x] > 0;
  const base = addMargin(body, m);
  const r = rngf(Math.trunc(seed * 11 + 5));
  const cx = W / 2;
  const cy = H * 0.48;
  // The tufts: walk in from outside along a ray to the crown's edge. Upper half and sides only.
  const tufts: Array<readonly [x: number, y: number, tone: number]> = [];
  const nTufts = Math.max(8, Math.trunc((cw + ch) / 14));
  for (let i = 0; i < nTufts; i++) {
    const a = Math.PI * (1.0 + (1.15 * (i + r.random())) / nTufts) - 0.08;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let t = Math.max(W, H);
    while (t > 0 && !filled(Math.trunc(cx + dx * t), Math.trunc(cy + dy * t), base)) t -= 1;
    if (t <= 0) continue;
    const l = dx * 0.55 - dy * 0.83;
    tufts.push([Math.trunc(cx + dx * (t + 1)), Math.trunc(cy + dy * (t + 1)), l > 0.45 ? hi : l > -0.3 ? ba : sd]);
  }
  // The clusters inside: leaves that catch the light for a moment.
  const inner: Array<readonly [x: number, y: number]> = [];
  const nInner = Math.trunc((cw * ch) / 1100);
  for (let i = 0; i < nInner * 4 && inner.length < nInner; i++) {
    const x = r.int(4, W - 4);
    const y = r.int(4, H - 4);
    const v = base.c[y * W + x];
    if (v === ba || v === sd) inner.push([x, y]);
  }
  const out: S[] = [];
  for (let f = 0; f < nFrames; f++) {
    const s = addMargin(body, m);
    s.use(90, 40);
    tufts.forEach(([x, y, tone], i) => {
      if (i % nFrames !== f) return;
      for (const [dx, dy] of STAMPS[i % STAMPS.length]) s.px(tone, x + dx, y + dy);
      for (const [dx, dy] of STAMPS[(i + 2) % STAMPS.length]) s.px(tone, x + dx - 1, y + dy + 1);
    });
    inner.forEach(([x, y], i) => {
      if (i % nFrames !== f) return;
      const st = STAMPS[(i + 1) % STAMPS.length];
      for (const [dx, dy] of st) if (filled(x + dx, y + dy, s)) s.px(s.c[y * W + x] === sd ? ba : hi, x + dx, y + dy);
    });
    s.finish(K);
    out.push(s);
  }
  return out;
}

/** A trunk like a hero's limb: four hard bands, lit on the right, with a few bark lines. */
export function trunk(s: S, cx: number, base: number, height: number, tw = 6, seed = 1): void {
  const r = rngf(seed);
  const [hi, ba, sd, dk] = R.bark;
  const th = Math.trunc(height);
  s.use(50, 2);
  for (let i = 0; i < th; i++) {
    const y = base - i;
    const u = i / th;
    const w = Math.max(3, Math.trunc(pyRound(tw * (1 - u * 0.42) + (1 - Math.min(u * 7, 1)) * tw * 0.5)));
    const x0 = Math.trunc(cx - w / 2 + Math.sin(u * 1.7 + seed) * 2);
    s.hl(sd, x0, y, w);
    s.px(dk, x0, y);
    if (w >= 3) s.px(w < 5 ? hi : ba, x0 + w - 1, y);
    if (w >= 5) {
      s.px(ba, x0 + w - 2, y);
      s.px(ba, x0 + w - 3, y);
    }
    if (w >= 7) s.px(hi, x0 + w - 2, y);
  }
  const lines = Math.trunc(th / 5);
  for (let q = 0; q < lines; q++) {
    const y = base - r.int(1, th);
    const u = (base - y) / th;
    const x0 = Math.trunc(cx + Math.sin(u * 1.7 + seed) * 2) + r.int(-2, 2);
    const L = r.int(2, 5);
    s.vl(dk, x0, y, L);
  }
}

/** A low clipped hedge: leaf clusters in hard bands. */
export function hedge(w: number, h: number, seed: number): S {
  const [a, b, c, d] = R.leaf;
  const r = rngf(seed);
  const s = new S(w, h);
  s.use(1, 1);
  s.rect(c, 0, 2, w, h - 2);
  s.hl(d, 0, h - 1, w);
  const n = Math.trunc((w * h) / 4);
  for (let q = 0; q < n; q++) {
    const x = r.int(0, w);
    const y = r.int(0, h);
    const v = 1 - y / h + (x / w) * 0.25 + (r.random() - 0.5) * 0.4;
    const t = v > 0.95 ? a : v > 0.55 ? b : v > 0.2 ? c : d;
    for (const [dx, dy] of STAMPS[r.int(0, 5)]) s.px(t, x + dx, y + dy);
  }
  const out = addMargin(s);
  out.finish();
  return out;
}
