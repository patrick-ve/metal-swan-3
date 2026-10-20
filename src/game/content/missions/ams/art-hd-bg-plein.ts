/**
 * UHD `ams-plein` (docs/ART_GUIDE.md "UHD art"): Museumplein at 2× and 4× from ONE density-generic
 * generator. Same design as the 1× layer (backgrounds.ts: the Rijksmuseum's back with its wings,
 * pavilions, passage and towers, the plane trees, the lawn, the long pool, tourists and the tram at
 * the same logical places, from the same hashes). Painted at middle distance (a light haze on the
 * museum, less on the lawn):
 *
 * - the museum: red brick with fine courses, cream stone bands lit on top with a shadow under them,
 *   round-arched windows in stone frames (glass that reflects the sky, mullions at 4×), a plinth,
 *   slate roofs in courses lit on the left slope, dormers, the passage arcade (deep arches in stone
 *   surrounds), two towers with lit faces, a clock-lantern stage and tall slate spires with gold
 *   tips;
 * - plane trees of leaf clusters on slim trunks;
 * - the lawn: mowing stripes, short grass strokes (4×), a little darker toward the viewer;
 * - the pool: a stone rim lit on top, sky in the water, ripples and glints;
 * - tourists: a head with hair, a coat lit on the left, two legs, a shadow, now and then a camera
 *   flash;
 * - the tram: a white body lit on top, the blue band, framed windows with passengers (4×),
 *   doors, the roof line, a pantograph on the overhead wire, the track.
 *
 * No ink outline (style decision: backgrounds).
 */
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { defineHdBgGenerator, type HdBgGenerator } from '../../../art/art-registry';
import { hash2 } from '../../../art/paint';
import { airOf, BAYER8, BgCanvas, homeOf, lightOf, pick, px, rampI } from './art-hd-bg-kit';
import { leafMass, trunk } from './art-hd-bg-trees';

const amsPleinHd: HdBgGenerator = (w, h, p, seed, d) => {
  const c = new BgCanvas(w, h, d);
  const light = lightOf(p);
  const lawn = px(p, 'y', 0.72, h);
  const far = airOf(light, 0.22);
  const midA = airOf(light, 0.12);
  const near = airOf(light, 0.05);
  const pxs = c.px;
  const W = c.W;
  // ---- The Rijksmuseum (logical layout of the 1× generator).
  const mx0 = Math.round(w * 0.12);
  const mw = Math.round(w * 0.76);
  const top = lawn - 50;
  const brick = rampI(far, PAL_HD.brick);
  const stone = rampI(far, PAL_HD.sand);
  const glass = rampI(far, PAL_HD.glass);
  const slateR = rampI(far, PAL_HD.slate);
  const gold = rampI(far, PAL_HD.gold);
  const ink = rampI(far, PAL_HD.ink);
  const course = 3;
  /** Brick wall [x0, x1) × [t, b): courses, a few bricks lighter; a light falloff to the right. */
  const wall = (x0: number, x1: number, t: number, b: number, lit = false): void => {
    const X0 = Math.round(x0 * d);
    const X1 = Math.round(x1 * d);
    for (let Y = Math.round(t * d); Y < Math.round(b * d); Y++) {
      if ((Y - Math.round(t * d)) % course === course - 1) {
        c.span(X0, X1, Y, brick[2]);
        continue;
      }
      const ci = Math.floor(Y / course);
      // Bricks of 8 art px, every eighth a tone lighter (one hash per brick).
      let X = X0;
      while (X < X1) {
        const end = Math.min(X1, (X & ~7) + 8);
        c.span(X, end, Y, brick[hash2(X >> 3, ci, seed + 5) < 0.12 ? 4 : 3]);
        X = end;
      }
      if (lit) c.span(X0, X0 + 2 * d, Y, brick[4]);
    }
  };
  /** A stone band [x0, x1) at y, h tall: lit top art px, a shadow line under it on the brick. */
  const band = (x0: number, x1: number, y: number, bh: number): void => {
    c.rect(x0, y, x1 - x0, bh, stone[5]);
    c.rect(x0, y, x1 - x0, 1 / d, stone[6]);
    c.rect(x0, y + bh - 1 / d, x1 - x0, 1 / d, stone[3]);
    c.rect(x0, y + bh, x1 - x0, 1 / d, brick[1]);
  };
  /** A round-arched window at (x, wy) (1× slot 3 × 10 below a 1 px arch). */
  const arched = (x: number, wy: number, wh: number): void => {
    c.rect(x - 0.25, wy - 0.75, 3.5, wh + 1, stone[5]);
    c.rect(x + 0.25, wy, 2.5, wh, glass[2]);
    c.rect(x + 0.25, wy, 2.5, wh * 0.35, glass[3]);
    c.rect(x + 0.25, wy, 0.5, wh, glass[1]);
    c.rect(x + 0.75, wy - 0.5, 1.5, 0.5, glass[2]);
    if (d === 4) {
      c.rect(x + 1.375, wy, 0.25, wh, stone[4]);
      c.rect(x + 0.25, wy + wh * 0.45, 2.5, 0.25, stone[4]);
    }
    c.rect(x + 1.75, wy + wh * 0.2, 0.5, 0.75, glass[4]);
    c.rect(x - 0.25, wy + wh, 3.5, 0.5, stone[6]);
  };
  const facade = (x0: number, x1: number, t: number): void => {
    wall(x0, x1, t, lawn);
    band(x0, x1, t, 2);
    band(x0, x1, t + 17, 2);
    band(x0, x1, t + 33, 1);
    c.rect(x0, lawn - 5, x1 - x0, 5, stone[4]);
    c.rect(x0, lawn - 5, x1 - x0, 0.5, stone[6]);
    c.rect(x0, lawn - 1, x1 - x0, 1, stone[3]);
    for (let x = x0 + 3; x + 3 < x1 - 2; x += 6) {
      for (const wy of [t + 5, t + 21]) arched(x, wy + 1, 10);
      c.rect(x, t + 36, 3, 6, glass[1]);
      c.rect(x, t + 36, 3, 1, glass[3]);
      c.rect(x + 0.5, t + 35.25, 2, 0.75, stone[5]);
    }
  };
  /** A steep slate roof: rows shrink inward, slate courses, the left slope lit. */
  const slate = (x0: number, x1: number, y0: number, h2: number): void => {
    for (let Y = Math.round((y0 - h2) * d); Y < y0 * d; Y++) {
      const r = (y0 * d - 1 - Y) / d;
      const inset = Math.round(r * 0.6 * d) / d;
      const X0 = Math.round((x0 + inset) * d);
      const X1 = Math.round((x1 - inset) * d);
      const xm = ((x0 + x1) / 2) * d;
      const crs = (y0 * d - 1 - Y) % (d === 4 ? 4 : 3) === 0;
      for (let X = X0; X < X1; X++) {
        const k = crs ? 1 : X < xm ? (X < X0 + d ? 5 : 4) : X > X1 - d ? 2 : 3;
        c.dot(X, Y, slateR[k]);
      }
    }
  };
  facade(mx0, mx0 + mw, top);
  slate(mx0, mx0 + mw, top, 9);
  for (let x = mx0 + 10; x < mx0 + mw - 10; x += 18) {
    // Dormers: a stone front with a small window and a lit cap.
    c.rect(x, top - 6, 4, 5, stone[5]);
    c.rect(x, top - 6, 4, 0.5, stone[6]);
    c.rect(x + 1, top - 5, 2, 3, glass[2]);
    c.rect(x + 1, top - 5, 2, 0.5, glass[4]);
    c.rect(x + 3.5, top - 6, 0.5, 5, stone[3]);
  }
  for (const p0 of [mx0 - 6, mx0 + mw - 34]) {
    facade(p0, p0 + 40, top - 8);
    c.rect(p0, top - 8, 2, lawn - top + 8, brick[4]);
    c.rect(p0 + 39.5, top - 8, 0.5, lawn - top + 8, brick[1]);
    slate(p0, p0 + 40, top - 8, 14);
  }
  const cx = mx0 + Math.round(mw / 2);
  facade(cx - 46, cx + 46, top - 10);
  slate(cx - 46, cx + 46, top - 10, 10);
  // The passage arcade: deep arches in stone surrounds.
  for (let k = -2; k <= 1; k++) {
    const ax = cx + k * 18 + 3;
    c.rect(ax - 1, lawn - 18, 14, 13, stone[5]);
    c.rect(ax - 1, lawn - 18, 14, 0.5, stone[6]);
    c.rect(ax, lawn - 16, 12, 11, ink[1]);
    c.rect(ax + 2, lawn - 17, 8, 1, ink[1]);
    c.rect(ax + 1, lawn - 16.5, 10, 0.5, ink[1]);
    // Light at the far end of the passage.
    c.rect(ax + 4, lawn - 13, 4, 8, brick[2]);
    c.rect(ax + 5, lawn - 12, 2, 7, stone[3]);
  }
  for (const tx of [cx - 40, cx + 18]) {
    const tw = 22;
    const tt = top - 44;
    wall(tx, tx + tw, tt, top - 10, true);
    c.rect(tx + tw - 1, tt, 1, top - 10 - tt, brick[1]);
    band(tx, tx + tw, tt, 2);
    band(tx, tx + tw, tt + 14, 2);
    band(tx, tx + tw, tt + 26, 1);
    for (const wx of [tx + 5, tx + 13]) {
      arched(wx, tt + 4, 9);
      c.rect(wx, tt + 18, 4, 7, glass[1]);
      c.rect(wx, tt + 18, 4, 1, glass[3]);
    }
    // The clock-lantern stage: louvres and a clock face.
    c.rect(tx + 3, tt - 6, tw - 6, 6, stone[4]);
    c.rect(tx + 3, tt - 6, tw - 6, 0.5, stone[6]);
    for (let x = tx + 5; x < tx + tw - 5; x += 3) c.rect(x, tt - 5, 1, 4, ink[1]);
    c.disc(tx + 11, tt - 3, 1.5, 1.5, (_X, _Y, u, v) => (Math.abs(u) < 0.2 && v < 0.1 ? ink[1] : Math.abs(v) < 0.2 && u > -0.1 ? ink[1] : stone[6]));
    // The tall slate spire: lit left half, shaded right half, a gold tip.
    for (let Y = (tt - 36) * d; Y < (tt - 6) * d; Y++) {
      const yy = (Y + 0.5) / d - (tt - 36);
      const half = Math.max(1, ((tw - 6) / 2) * (yy / 29));
      const X0 = Math.round((tx + 11 - half) * d);
      const X1 = Math.round((tx + 11 + half) * d);
      const xm = (tx + 11) * d;
      for (let X = X0; X < X1; X++) c.dot(X, Y, slateR[X < xm ? (X < X0 + d / 2 ? 6 : 5) : X > X1 - d ? 1 : 2]);
    }
    c.rect(tx + 10, tt - 41, 2, 5, gold[4]);
    c.rect(tx + 10, tt - 41, 0.5, 5, gold[6]);
    c.rect(tx + 10, tt - 42, 2, 1, gold[6]);
  }
  // ---- Plane trees in a row in front of the museum.
  const leaf = rampI(midA, PAL_HD.green);
  const bark = rampI(midA, PAL_HD.brown.slice(1, 7));
  for (let k = 0; k < Math.round(w / 48); k++) {
    const tx = Math.round(k * 48 + 24 + (hash2(k, 1, seed) - 0.5) * 12);
    const r = 9 + Math.floor(hash2(k, 2, seed) * 5);
    trunk(c, tx, lawn - 14, lawn, 2, bark, seed + k);
    const ty = lawn - 14 - r + 4 + 0.5;
    leafMass(c, tx + 0.5, ty, r + 0.5, leaf, seed + k * 17, { x: tx, y: ty, r }, 0.55);
  }
  // ---- The lawn: mowing stripes, darker toward the viewer, grass strokes at 4×.
  const grass = rampI(near, PAL_HD.green);
  const sw = 24 * d;
  for (let Y = lawn * d; Y < c.H; Y++) {
    const y = Y / d - lawn;
    const row = Y * W;
    const dark = y / 40;
    const fr = dark - Math.floor(dark);
    if (Y < lawn * d + Math.max(1, d >> 1)) {
      c.span(0, W, Y, grass[6]);
      continue;
    }
    if (fr > 0.35 && fr < 0.65) {
      // Away from a band border: whole stripes as spans.
      const kd = Math.floor(dark);
      for (let X = 0; X < W; X += sw) c.span(X, Math.min(W, X + sw), Y, grass[Math.max(2, (Math.floor(X / sw) % 2 === 0 ? 5 : 4) - kd)]);
      continue;
    }
    const brow = (Y & 7) << 3;
    for (let X = 0; X < W; X++) {
      const k = (Math.floor(X / sw) % 2 === 0 ? 5 : 4) - Math.floor(dark + (BAYER8[brow | (X & 7)] - 0.5) * 0.7);
      pxs[row + X] = grass[k < 2 ? 2 : k];
    }
  }
  if (d === 4) {
    for (let y = lawn + 1; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const hv = hash2(x, y, seed + 8);
        if (hv > 0.45) continue;
        const X = x * d + Math.floor(hv * 9) % 4;
        const Y = y * d + 1;
        const stripe = Math.floor(x / 24) % 2 === 0;
        const k = (stripe ? 5 : 4) - Math.floor((y - lawn) / 40) + (hv < 0.2 ? 1 : -1);
        c.dot(X, Y, grass[Math.max(2, Math.min(7, k))]);
        c.dot(X, Y + 1, grass[Math.max(2, Math.min(7, k))]);
      }
    }
  }
  // ---- The long pool: a stone rim, sky in the water, ripples and glints.
  const py = lawn + 8;
  const p0 = Math.round(w * 0.1);
  const pw = Math.round(w * 0.8);
  const rim = rampI(near, PAL_HD.stone);
  const sky = rampI(near, PAL_HD.sky);
  c.rect(p0, py, pw, 6, rim[5]);
  c.rect(p0, py, pw, 0.5, rim[6]);
  c.rect(p0, py + 5.5, pw, 0.5, rim[3]);
  c.rect(p0 + 2, py + 1, pw - 4, 4, sky[4]);
  c.rect(p0 + 2, py + 1, pw - 4, 0.75, sky[2]);
  c.rect(p0 + 2, py + 3.5, pw - 4, 1.5, sky[5]);
  for (let x = p0 + 2; x < p0 + pw - 2; x++) {
    if (hash2(x, 1, seed) > 0.8) c.rect(x, py + 2, 1, 0.5, sky[7]);
    else if (hash2(x, 2, seed) > 0.85) c.rect(x, py + 3, 1.5, 0.25, sky[6]);
  }
  // ---- Tourists: head and hair, a coat lit on the left, two legs, a shadow, a camera flash.
  const coats = [PAL.red[2], PAL.gold[2], PAL.sky[1], PAL.pink[2], PAL.snow[3], PAL.green[1], PAL.orange[1]];
  const skins = [PAL.skinA[2], PAL.skinB[2], PAL.skinC[2]];
  const hairs = [PAL_HD.hairA[2], PAL_HD.hairB[3], PAL_HD.hairC[4]];
  const legs = rampI(near, PAL_HD.denim);
  for (let x = 2; x < w; x += 5) {
    if (hash2(x, 3, seed) < 0.55) continue;
    const y = lawn + 2 + Math.floor(hash2(x, 4, seed) * 4);
    const ch = homeOf(coats[Math.floor(hash2(x, 5, seed) * coats.length)]);
    const coat = rampI(near, ch.ramp);
    const cm = Math.max(1, Math.min(coat.length - 2, ch.i));
    const sh = homeOf(skins[Math.floor(hash2(x, 6, seed) * 3)]);
    const skin = rampI(near, sh.ramp);
    c.rect(x - 0.5, y + 4.75, 3, 0.5, grass[2]);
    c.rect(x, y, 1, 1, skin[Math.min(skin.length - 1, sh.i + 1)]);
    c.rect(x, y, 1, 0.5, near(hairs[Math.floor(hash2(x, 9, seed) * 3)]));
    c.rect(x, y + 1, 2, 3, coat[cm]);
    c.rect(x, y + 1, 0.5, 3, coat[cm + 1]);
    c.rect(x + 1.5, y + 1, 0.5, 3, coat[cm - 1]);
    c.rect(x + 0.25, y + 4, 0.5, 1, legs[2]);
    c.rect(x + 1.25, y + 4, 0.5, 1, legs[1]);
    if (hash2(x, 7, seed) < 0.2) {
      c.rect(x + 2, y, 1, 1, pick(sky, 7));
      c.rect(x + 2, y + 0.25, 0.5, 0.5, near(PAL.ink[1]));
    }
  }
  // ---- The tram on its track, the overhead wire.
  const tx0 = Math.round(w * 0.62);
  const ty = lawn - 13;
  const steel = rampI(near, PAL_HD.steel);
  const body = rampI(near, PAL_HD.gable);
  const blue = rampI(near, PAL_HD.sky);
  const win = rampI(near, PAL_HD.glass);
  c.rect(0, ty + 14, w, 1, steel[3]);
  c.rect(0, ty + 14, w, 0.25, steel[5]);
  c.rect(tx0, ty, 90, 14, body[5]);
  c.rect(tx0, ty, 90, 0.5, body[6]);
  c.rect(tx0, ty + 12, 90, 2, body[3]);
  c.rect(tx0, ty + 9, 90, 3, blue[1]);
  c.rect(tx0, ty + 9, 90, 0.5, blue[3]);
  c.rect(tx0, ty - 1, 90, 1, steel[5]);
  c.rect(tx0 + 89.5, ty, 0.5, 14, body[2]);
  for (let x = tx0 + 4; x < tx0 + 86; x += 9) {
    c.rect(x, ty + 2, 6, 5, win[1]);
    c.rect(x, ty + 2, 6, 1, win[3]);
    c.rect(x + 4, ty + 3, 1.5, 0.5, win[4]);
    if (d === 4 && hash2(x, 11, seed) < 0.6) {
      const sk = rampI(near, homeOf(skins[Math.floor(hash2(x, 12, seed) * 3)]).ramp);
      c.rect(x + 1.25, ty + 4.5, 1, 1, sk[4]);
      c.rect(x + 1, ty + 5.5, 1.5, 1.5, near(coats[Math.floor(hash2(x, 13, seed) * coats.length)]));
    }
    c.rect(x - 0.5, ty + 2, 0.5, 5, body[3]);
  }
  for (let x = tx0 + 28; x < tx0 + 90; x += 30) {
    c.rect(x, ty, 1, 14, steel[3]);
    c.rect(x, ty, 0.25, 14, steel[5]);
  }
  // Bogies in shadow under the body (4×).
  if (d === 4) for (const bx of [tx0 + 8, tx0 + 70]) c.rect(bx, ty + 13.5, 12, 0.5, steel[1]);
  // The pantograph on the wire.
  c.line(tx0 + 30.5, ty - 1, tx0 + 26, ty - 4.5, steel[1]);
  c.line(tx0 + 26, ty - 4.5, tx0 + 30.5, ty - 8, steel[1]);
  c.rect(tx0 + 24, ty - 8.5, 13, 0.5, steel[1]);
  c.rect(0, ty - 9, w, 0.5, steel[1]);
  return c.finish();
};

defineHdBgGenerator('ams-plein', amsPleinHd);
