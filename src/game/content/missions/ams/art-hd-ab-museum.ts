/**
 * Mission `ams` UHD Rijksmuseum (docs/ART_GUIDE.md "UHD art"): the 1× layout of art.ts `rijksmuseum`
 * (482 × 176, anchor (241, 176): the cycle passage 81 … 400 under an 80 px ceiling, two towers, the
 * slate roof with dormers, tall arched windows, banners) painted as a lit facade at d 2 and 4: red
 * brick with mortar, weathering and cream stone bands, slates with lit lower edges, arched windows
 * reflecting the sky, the passage vault in deep shade with lamps, niches and the tiled dado with
 * its blue band, clock faces, belfry openings, spires with a gold vane. Outline C.
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, brick, plaster, texAll, type Texture } from '../../../art/hd/index';
import { hash2, noise2 } from '../../../art/paint';
import { face, fr, glow, h01, ring, type D, type P } from './art-hd-ab-kit';

/** The Rijksmuseum at density d. */
export function rijksmuseumHd(d: D): Frame {
  const W = 480;
  const H = 176;
  const c = new HdCanvas(W + 2, H, d);
  const base = H - 1;
  const ceil = base - 80;
  const roofY = 58;
  const p0 = 81;
  const p1 = 400;
  const brickM = face(c, PAL_HD.brick, { lo: 1, hi: 5 });
  const mortar = face(c, PAL_HD.stone, { lo: 2, hi: 4 });
  const stone = face(c, PAL_HD.sand, { lo: 3, hi: 7, spec: 0.1 });
  const slate = face(c, PAL_HD.slate, { lo: 1, hi: 5 });
  const glass = glow(c, PAL_HD.glass);
  const ink = glow(c, PAL_HD.black, { lo: 0, hi: 3, dither: 0.25 });
  // The passage vault: warm dark brick lit only by its lamps (6 tones, ordered dither at the band
  // borders of the big gradient).
  const vault = glow(c, PAL_HD.brickDark, { lo: 0, hi: 5, dither: 0.25 });
  const tile = face(c, PAL_HD.plaster, { lo: 3, hi: 6, spec: 0.3 });
  const blue = face(c, PAL_HD.sky, { lo: 0, hi: 3, spec: 0.3 });
  const lampM = glow(c, PAL_HD.gold, { lo: 3, hi: 7 });
  const gold = face(c, PAL_HD.gold, { lo: 2, hi: 6, spec: 1, shine: 20 });
  const dial = face(c, PAL_HD.gable, { lo: 3, hi: 6 });
  const hand = glow(c, PAL_HD.ink, { lo: 0, hi: 1 });
  const red = face(c, PAL_HD.red, { lo: 2, hi: 6, wrap: 0.25 });
  const yellow = face(c, PAL_HD.gold, { lo: 3, hi: 6, wrap: 0.25 });
  const wallPart = c.newPart();
  const bricks: Texture = texAll(brick({ mortar, bw: 3, bh: 1.5, joint: 0.5, wear: 0.55, seed: 31 }), (s) => {
    if (s.y > base - 6) s.tone -= (s.y - (base - 6)) * 0.03 * (0.5 + noise2(s.x, s.y, 5, 33));
  });

  // ---- Main wall, the stone bands. ----
  c.box(1, roofY, W, base - roofY + 1, { mat: brickM, z: 0, part: wallPart, tex: bricks });
  for (const [y, h, n] of [[roofY - 0.2, 2.2, [0, -0.5, 0.86]], [ceil - 2, 2, [0, 0.4, 0.92]]] as const) c.box(0.6, y, W + 0.8, h, { mat: stone, z: 1.2, bevel: 0.45, n });
  // ---- The slate roof with dormers. ----
  c.plane(1, 44, W, 14, {
    mat: slate,
    z: -1,
    mask: (x, y) => {
      const inset = (roofY - y) * 0.6;
      return x >= 1 + inset && x <= W + 1 - inset;
    },
    normal: (_x, _y, n) => {
      n[0] = 0;
      n[1] = -0.55;
      n[2] = 0.83;
    },
    tex: (s) => {
      // Slates: staggered rows, each with a lit lower lip and a dark gap above the next row.
      const row = Math.floor((s.y - 44) / 1.5);
      const fy = (s.y - 44) / 1.5 - row;
      const col = Math.floor((s.x + (row & 1) * 1.25) / 2.5);
      s.tone += (hash2(col, row, 41) - 0.5) * 0.2;
      if (fy > 0.75) s.tone += 0.18;
      else if (fy < 0.2) s.tone -= 0.3;
    },
  });
  for (let x = 20; x < W - 20; x += 40) {
    c.box(x, 48, 8, 10, { mat: brickM, z: 0.8, bevel: 0.4, tex: bricks });
    c.poly([[x - 1, 48.4], [x + 9, 48.4], [x + 4.5, 43]], { mat: stone, z: 1.1, n: [0, -0.4, 0.92] });
    ring(c, x + 1.5, 49.5, 5, 7, 0.5, { mat: stone, z: 1 });
    c.plane(x + 2, 50, 4, 6, { mat: glass, z: 0.6, tex: (s) => { s.tone = -0.1 + (56 - s.y) * 0.05; } });
  }

  // ---- Tall arched windows on the upper floor. ----
  const archWin = (x: number, y: number, w: number, h: number, archH: number, seed: number, z = 0): void => {
    // Glass over the rectangle and its arch; a cream frame and mullion.
    const inside = (px: number, py: number): boolean => py >= y + archH / 2 ? true : ((px - x - w / 2) / (w / 2)) ** 2 + ((py - y - archH / 2) / (archH / 2)) ** 2 <= 1;
    c.erase(x, y, w, h, (px, py) => inside(px, py));
    c.plane(x - 1, y - 1, w + 2, h + 1.5, {
      mat: stone,
      z: z + 0.5,
      mask: (px, py) => {
        const ix = px - x - w / 2;
        const iy = py - y - archH / 2;
        const outer = py >= y + archH / 2 ? Math.abs(ix) <= w / 2 + 1 && py <= y + h + 0.5 : (ix / (w / 2 + 1)) ** 2 + (iy / (archH / 2 + 1)) ** 2 <= 1;
        return outer && !inside(px, py);
      },
    });
    c.plane(x, y, w, h, {
      mat: glass,
      z: z - 1.2,
      mask: inside,
      tex: (s) => {
        const v = (s.y - y) / h;
        s.tone = -0.2 + (1 - v) * 0.25;
        const st = Math.abs((s.x - x) / w + v * 0.7 - 0.4 - h01(seed, 1, 5) * 0.4);
        if (st < 0.06) s.tone += 0.4;
        else if (st < 0.12) s.tone += 0.18;
      },
    });
    c.box(x + w / 2 - 0.3, y + 1, 0.6, h - 1, { mat: stone, z: z - 0.4, bevel: 0.2 });
    c.box(x, y + h * 0.42, w, 0.6, { mat: stone, z: z - 0.4, bevel: 0.2 });
    c.box(x - 1.3, y + h, w + 2.6, 1, { mat: stone, z: z + 1, bevel: 0.35, n: [0, -0.45, 0.89] });
  };
  for (let x = 12; x < W - 12; x += 20) archWin(x, roofY + 6, 8, 20, 6, x);

  // ---- The passage: the vault in deep shade, niches with lamps, the tiled dado. ----
  c.erase(p0, ceil, p1 - p0 + 1, base - ceil + 1, () => true);
  // Lamp light: a warm pool round each hanging lamp (falling off over about 14 logical px), and
  // daylight from both passage mouths.
  const lampLight = (x: number, y: number): number => {
    const j = Math.max(0, Math.min(Math.floor((p1 - p0 - 21) / 40), Math.round((x - p0 - 20) / 40)));
    const lx = p0 + 20 + j * 40 + 0.5;
    const q = 1 - Math.hypot(x - lx, (y - (ceil + 13.5)) * 0.85) / 14;
    const mouth = 1 - Math.min(x - p0, p1 + 1 - x) / 28;
    return (q > 0 ? q * q * 0.44 : 0) + (mouth > 0 ? mouth * mouth * 0.16 : 0);
  };
  c.plane(p0, ceil, p1 - p0 + 1, base - ceil + 1, {
    mat: vault,
    z: -6,
    tex: (s) => {
      passage(s);
      s.tone += lampLight(s.x, s.y) * (s.mat === vault ? 1 : 0.7);
    },
  });
  function passage(s: Parameters<Texture>[0]): void {
    {
      const depth = s.y - ceil;
      const k = (s.x - p0) % 40;
      const archTop = ceil + 18 + ((k - 20) * (k - 20)) / 40;
      s.tone = -0.36 + Math.min(1, depth / 30) * 0.2;
      // The tiled dado below, the blue band.
      if (s.y > base - 24 && (k <= 4.5 || k >= 35.5)) {
        s.mat = tile;
        s.tone = 0;
        s.dz = 3;
        if (((Math.floor(s.x) + Math.floor(s.y)) & 3) === 0) s.tone -= 0.12;
        if (Math.abs(s.y - (base - 17.5)) < 0.5) s.mat = blue;
        return;
      }
      // Niches: an arch edge in stone, a deeper inside.
      if (k > 4.5 && k < 35.5) {
        if (Math.abs(s.y - archTop - 1) < 0.5) {
          s.mat = stone;
          s.tone = -0.25;
          s.dz = 2;
        } else if (s.y > base - 30) {
          // The lower niche: dark brick in the shade of the passage.
          s.mat = brickM;
          s.tone = -0.55 + (s.y - (base - 30)) * 0.004;
          if (((s.y - (base - 30)) % 1.5) < 0.3 || ((Math.floor((s.y - (base - 30)) / 1.5) & 1 ? 1.5 : 0) + s.x) % 3 < 0.3) s.tone -= 0.2;
        } else if (s.y > archTop) s.tone -= 0.1 - (s.y - archTop) * 0.004;
      } else if (s.y < base - 24) {
        // The piers between the niches: brick in the passage's shade, lit a little from the mouth.
        s.mat = brickM;
        s.tone = -0.42 + (k > 35 ? 0.08 : 0);
        const yy = s.y - ceil;
        const row = Math.floor(yy / 1.5);
        if (yy % 1.5 < 0.3 || ((s.x + (row & 1 ? 1.5 : 0)) % 3) < 0.3) s.tone -= 0.22;
      }
    }
  }
  c.shade(p0, ceil, p1 - p0 + 1, 8, (_x, y) => -(1 - (y - ceil) / 8) * 0.4);
  for (let x = p0; x <= p1; x += 20) c.box(x - 0.4, ceil, 0.9, 4.5, { mat: stone, z: -4, tone: -0.4 });
  for (let x = p0 + 20; x < p1; x += 40) {
    c.capsule(x + 0.5, ceil + 6, x + 0.5, ceil + 10.5, 0.2, 0.2, { mat: hand, z: -3 });
    c.ellipsoid(x + 0.5, ceil + 13.5, 2.3, 2.5, { mat: lampM, z: -2.8, tone: 0.25 });
    c.box(x - 1.2, ceil + 10.6, 3.4, 1, { mat: gold, z: -2.6, bevel: 0.3 });
  }

  // ---- Towers at both passage ends. ----
  for (const tx of [p0 - 20, p1 - 18]) {
    const tw = 38;
    const t0 = 24;
    const tp = c.newPart();
    c.plane(tx, t0, tw, base - t0 + 1, {
      mat: brickM,
      z: 1,
      part: tp,
      mask: (x, y) => !(y > ceil && x > p0 && x < p1 + 1),
      tex: bricks,
    });
    c.shade(tx, t0, 1, ceil - t0, () => 0.15, tp);
    c.shade(tx + tw - 1, t0, 1, ceil - t0, () => -0.2, tp);
    for (const y of [t0, t0 + 16, ceil - 2]) c.box(tx - 0.4, y - 0.2, tw + 0.8, 1.6, { mat: stone, z: 2, bevel: 0.4, n: [0, -0.3, 0.95] });
    // Corner pinnacles.
    for (const px of [tx - 1, tx + tw - 3]) {
      c.box(px, t0 - 8, 4, 8, { mat: stone, z: 2.2, bevel: 0.5 });
      c.poly([[px, t0 - 7.8], [px + 4, t0 - 7.8], [px + 2, t0 - 14]], { mat: slate, z: 2.3, n: [0.1, -0.3, 0.95] });
    }
    // Belfry openings, the clock, the tall window.
    for (const bx of [tx + 6, tx + 22]) {
      const ins = (px: number, py: number): boolean => py >= t0 + 5 ? true : ((px - bx - 5) / 5) ** 2 + ((py - t0 - 5) / 3) ** 2 <= 1;
      c.erase(bx, t0 + 2, 10, 12, ins);
      c.plane(bx, t0 + 2, 10, 12, { mat: ink, z: -3, mask: ins, tex: (s) => { s.tone = -0.3 + (s.y - t0 - 2) * 0.02; } });
      ring(c, bx - 0.5, t0 + 13.5, 11, 1, 0.5, { mat: stone, z: 1.6 });
    }
    const ccx = tx + 19.5;
    const ccy = t0 + 26.5;
    c.plane(ccx - 6.5, ccy - 6.5, 13, 13, {
      mat: stone,
      z: 1.8,
      mask: (x, y) => Math.hypot(x - ccx, y - ccy) <= 6.5,
      normal: (x, y, n) => {
        const q = Math.hypot(x - ccx, y - ccy) || 1;
        const k = q > 5.3 ? (q - 5.3) / 1.2 : 0;
        n[0] = ((x - ccx) / q) * k * 0.8;
        n[1] = ((y - ccy) / q) * k * 0.8;
        n[2] = 1;
      },
    });
    c.plane(ccx - 5.3, ccy - 5.3, 10.6, 10.6, { mat: dial, z: 2.2, mask: (x, y) => Math.hypot(x - ccx, y - ccy) <= 5.2, tex: (s) => { s.tone += (ccy - s.y) * 0.02; } });
    c.capsule(ccx, ccy, ccx, ccy - 4, 0.3, 0.25, { mat: hand, z: 2.6 });
    c.capsule(ccx, ccy, ccx + 3, ccy + 0.8, 0.3, 0.25, { mat: hand, z: 2.6 });
    if (d >= 4) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      c.dot(ccx + Math.cos(a) * 4.5, ccy + Math.sin(a) * 4.5, PAL_HD.ink[1]);
    }
    archWin(tx + 11, t0 + 36, 16, ceil - t0 - 41, 9, tx, 1);
    // The spire: slate, lit on the left, bands, a gold vane.
    const sx = tx + tw / 2;
    c.plane(tx, 0, tw, t0, {
      mat: slate,
      z: 0.5,
      mask: (x, y) => Math.abs(x - sx) <= Math.max(0.6, (tw / 2 - 3) * Math.pow(y / t0, 1.6)),
      normal: (x, y, n) => {
        const half = Math.max(0.6, (tw / 2 - 3) * Math.pow(y / t0, 1.6));
        n[0] = ((x - sx) / half) * 0.8;
        n[1] = -0.35;
        n[2] = 0.6;
      },
      tex: (s) => {
        if (s.y % 6 > 5.3) s.tone -= 0.25;
        if (s.d >= 4 && Math.floor((s.x - sx) * 2 + 100) % 3 === 0) s.tone -= 0.06;
      },
    });
    c.capsule(sx, 0.4, sx, 4.5, 0.4, 0.4, { mat: gold, z: 1.5 });
    c.ellipsoid(sx + 0.8, 1.2, 1.1, 0.6, { mat: gold, z: 1.6 });
  }
  // ---- The passage mouths: cream stone arches framing each end. ----
  for (const ax of [p0, p1]) c.box(ax - 3, ceil - 4, 6, base - ceil + 5, { mat: stone, z: 2.5, bevel: 0.8, tex: plaster({ seed: ax, cracks: 0.3, stains: 0.5 }) });
  // ---- Ground-floor windows outside the passage. ----
  for (const x of [8, 30, 430, 452]) archWin(x, ceil + 5, 10, 40, 8, x * 3);
  // ---- Banners on the facade (our own museum banners, no logos). ----
  for (const [x, m] of [[150, red], [310, yellow]] as const) {
    const bp: P[] = [[x, roofY + 4], [x + 10, roofY + 4], [x + 10, roofY + 30], [x + 5, roofY + 34.5], [x, roofY + 30]];
    c.poly(bp, {
      mat: m,
      z: 2,
      n: [0, 0, 1],
      tex: (s) => {
        const f = Math.sin((s.x - x) * 0.9);
        s.nx += f * 0.3;
        if (s.x - x < 1) s.fix = PAL_HD.snow[5];
      },
    });
    c.capsule(x - 0.5, roofY + 3.6, x + 10.5, roofY + 3.6, 0.35, 0.35, { mat: gold, z: 2.3 });
  }
  return fr(c.render({ outline: 'C', sep: true, sepZ: 0.7, ao: 0.3, shadow: 0.32, shadowMax: 3 }), 241, H, d);
}
