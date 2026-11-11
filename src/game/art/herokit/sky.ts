/** The far layers (docs/design/ams2.md §1.2): flat tones, no outline. Hard bands, no dither. */
import { S } from './canvas';
import { R } from './palette';
import { rngf } from './rng';
import { gablePts, type GableKind } from './walls';

/** Sky in hard bands with stepped edges, no dither. `tones` has one more entry than `stops`. */
export function skyBands(s: S, tones: readonly number[], stops: readonly number[], seed = 1): void {
  const r = rngf(seed);
  const edges: Int32Array[] = [];
  for (const y of stops) {
    const e = new Int32Array(s.w);
    let x = 0;
    while (x < s.w) {
      const L = r.int(6, 24);
      const v = r.int(0, 3);
      for (let i = x; i < x + L && i < s.w; i++) e[i] = y + v;
      x += L;
    }
    edges.push(e);
  }
  s.c.fill(tones[0]);
  s.z.fill(-5);
  edges.forEach((ee, i) => {
    for (let x = 0; x < s.w; x++) for (let y = ee[x]; y < s.h; y++) s.c[y * s.w + x] = tones[i + 1];
  });
}

/** A cumulus in hard bands: lit on the upper right, grey-blue under, separated clumps. No outline: it stays far away. */
export function cloudSprite(w: number, h: number, seed: number, flat = true, mat = 'cloud'): S {
  const r = rngf(seed);
  const [a, b, c, d] = R[mat];
  const s = new S(w + 4, h + 4);
  const n = Math.trunc(w / 5) + 3;
  const pf: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const px = 2 + r.random() * w;
    const env = (1 - Math.abs(((px - 2) / w) * 2 - 1)) ** 0.7;
    const cy = h + 1 - r.random() * (h - 3) * env;
    const rr = 2.5 + h * 0.2 * (0.5 + 0.6 * r.random()) * Math.max(env, 0.45);
    pf.push([px, cy, rr]);
  }
  pf.sort((p, q) => p[1] - q[1]);
  pf.forEach(([cx, cy, rr], i) => {
    s.use(10 + i, 1 + i * 0.4);
    s.ell(c, cx, cy, rr, rr * 0.85);
    const k0 = new Uint8Array(s.w * s.h);
    const k1 = new Uint8Array(s.w * s.h);
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if ((x - cx) ** 2 + ((y - cy) / 0.85) ** 2 > rr * rr) continue;
        const L = ((x - cx) * 0.55 - (y - cy) * 0.83) / rr;
        if (L > -0.45) k0[y * s.w + x] = 1;
        if (L > 0.2) k1[y * s.w + x] = 1;
      }
    }
    s.maskPaint(b, k0);
    s.maskPaint(a, k1);
  });
  if (flat) {
    for (let y = h + 2; y < s.h; y++) for (let x = 0; x < s.w; x++) s.c[y * s.w + x] = 0;
    for (let x = 0; x < s.w; x++) {
      if (s.c[(h + 1) * s.w + x] > 0) s.c[(h + 1) * s.w + x] = d;
      if (s.c[h * s.w + x] > 0) s.c[h * s.w + x] = c;
    }
  }
  s.finish(0);
  return s;
}

/** The far city: flat gables on `base`. */
export function skyline(s: S, base: number, seed: number): void {
  const r = rngf(seed);
  let x = -6;
  const [a, b, c] = R.far;
  const rb = R.farr[1];
  while (x < s.w) {
    const w = r.int(14, 28);
    const h = r.int(22, 50);
    const kind = r.pick<GableKind>(['step', 'neck', 'spout', 'bell']);
    const o = new S(w, h + 14);
    o.use(1, 1);
    const tone = [a, b, c][r.int(0, 3)];
    o.poly(tone, gablePts(kind, w, 14));
    o.rect(tone, 0, 14, w, h);
    o.vl(tone !== c ? c : rb, 0, 14, h);
    for (let wy = 18; wy < h + 10; wy += 8) {
      const cnt = Math.floor((w - 3) / 6);
      for (let i = 0; i < cnt; i++) o.rect(rb, 3 + i * 6, wy, 2, 3);
    }
    s.paste(o, x, base - h - 14);
    x += w + r.int(-1, 3);
  }
}

export function farTower(s: S, x: number, base: number, h: number): void {
  const [a, b, c] = R.far;
  const [ra, rb] = R.farr;
  const w = Math.max(8, Math.floor(h / 6));
  s.rect(b, x, base - h, w, h);
  s.vl(a, x + w - 1, base - h, h);
  s.vl(c, x, base - h, h);
  for (let j = base - h + 4; j < base - Math.floor(h / 3); j += 11) {
    s.hl(a, x, j, w);
    s.rect(rb, x + (w >> 1) - 1, j + 3, 2, 4);
  }
  s.rect(a, x + 1, base - h - 8, w - 2, 8);
  s.rect(rb, x + (w >> 1) - 1, base - h - 6, 2, 4);
  s.poly(ra, [
    [x, base - h - 8],
    [x + w / 2, base - h - 28],
    [x + w, base - h - 8],
  ]);
  s.poly(rb, [
    [x, base - h - 8],
    [x + w / 2, base - h - 28],
    [x + w / 2, base - h - 8],
  ]);
}

/** Birds far away: four wing frames, dark and hard. */
export function birdFrames(): S[] {
  const F = [
    ['K.....K', '.K...K.', '..K.K..', '...K...'],
    ['K.....K', 'KK...KK', '..KKK..'],
    ['..KKK..', '.K...K.', 'K.....K'],
    ['KK...KK', '..KKK..'],
  ];
  return F.map((g) => {
    const s = new S(7, 5);
    s.use(1, 1);
    s.grid(g, 0, 0, { K: 1 });
    s.finish(0);
    return s;
  });
}
