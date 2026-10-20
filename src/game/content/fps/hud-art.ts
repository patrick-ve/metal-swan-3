/**
 * The first-person status bar pieces (docs/design/fps.md §8.5, layout §8.6): `fps/hud/bar`
 * (384 × 40), `fps/hud/weapon` (48 × 20, 4 frames: knife, pistol, mg, chaingun) and
 * `fps/hud/key` (8 × 14, 2 frames: gold, silver). Top-left anchors. Our own layout: the face
 * porthole at the left edge, recessed panels for the middle and weapon blocks.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { PAL_HD } from '../../../engine/palette-hd';
import { defineSprite } from '../../../engine/sprites';
import { HdCanvas, type Texture } from '../../art/hd';
import { hash2 } from '../../art/paint';

export const BAR_W = 384;
export const BAR_H = 40;

function rivet(b: PixelBuffer, x: number, y: number): void {
  b.set(x, y, PAL.steel[3]);
  b.set(x + 1, y, PAL.steel[2]);
  b.set(x, y + 1, PAL.steel[2]);
  b.set(x + 1, y + 1, PAL.navy[0]);
}

/** A recessed panel: dark inside, shadow top / left, light lip bottom / right. */
function recess(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number): void {
  b.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, PAL.navy[0]);
  b.hline(x0, x1, y0, INK);
  b.vline(x0, y0, y1, INK);
  b.hline(x0 + 1, x1, y0 + 1, PAL.ink[1]);
  b.hline(x0, x1, y1, PAL.steel[2]);
  b.vline(x1, y0, y1, PAL.steel[2]);
}

export function barArt(): PixelBuffer {
  const b = new PixelBuffer(BAR_W, BAR_H);
  // brushed navy-steel plate
  for (let y = 0; y < BAR_H; y++) {
    for (let x = 0; x < BAR_W; x++) {
      const n = hash2(x >> 3, y, 5);
      b.data[y * BAR_W + x] = n < 0.12 ? PAL.slate[0] : n > 0.9 ? PAL.slate[2] : PAL.slate[1];
    }
  }
  b.hline(0, BAR_W - 1, 0, PAL.steel[3]);
  b.hline(0, BAR_W - 1, 1, PAL.slate[2]);
  b.hline(0, BAR_W - 1, BAR_H - 1, INK);
  b.hline(0, BAR_W - 1, BAR_H - 2, PAL.navy[0]);
  // block dividers
  for (const x of [48, 116, 240, 256]) {
    b.vline(x, 2, BAR_H - 3, PAL.navy[0]);
    b.vline(x + 1, 2, BAR_H - 3, PAL.slate[2]);
  }
  // health block, middle block, key slots, weapon block
  recess(b, 50, 3, 113, 36);
  recess(b, 118, 3, 238, 36);
  recess(b, 243, 4, 253, 20);
  recess(b, 243, 21, 253, 37);
  recess(b, 258, 3, 381, 36);
  // the weapon block's silhouette window and divider
  b.vline(310, 4, 35, PAL.ink[1]);
  // the porthole at the left: a brass ring with bolts around a dark glass
  const cx = 26;
  const cy = 20;
  for (let y = 0; y < BAR_H; y++) {
    for (let x = 2; x < 50; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 19.5) continue;
      let c: Color;
      if (d <= 16) c = PAL.navy[0];
      else if (d <= 17) c = INK;
      else {
        const lit = (x - cx) * -0.6 + (y - cy) * -0.8;
        c = lit > 6 ? PAL.brass[3] : lit > 0 ? PAL.brass[2] : lit > -8 ? PAL.brass[1] : PAL.brass[0];
      }
      b.data[y * BAR_W + x] = c;
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.round(cx + Math.cos(a) * 18.2 - 0.5);
    const y = Math.round(cy + Math.sin(a) * 18.2 - 0.5);
    b.set(x, y, PAL.brown[0]);
  }
  // rivets along the plate
  for (let x = 60; x < BAR_W - 4; x += 32) {
    if (x > 112 && x < 120) continue;
    rivet(b, x, 1);
  }
  for (const x of [114, 241, 254]) {
    rivet(b, x, 4);
    rivet(b, x, 34);
  }
  rivet(b, BAR_W - 3, 4);
  rivet(b, BAR_W - 3, 34);
  return b.touch();
}

/** Weapon silhouettes for the weapon block (side view, muzzle right). */
export function weaponIcon(i: number): PixelBuffer {
  const b = new PixelBuffer(48, 20);
  const body = PAL.steel[2];
  const lit = PAL.steel[3];
  const dark = PAL.steel[1];
  const wood = PAL.brown[2];
  if (i === 0) {
    // knife
    b.rect(6, 9, 10, 3, wood);
    b.rect(16, 7, 2, 7, dark);
    b.tri(18, 8, 18, 12, 42, 10, body);
    b.hline(18, 38, 9, lit);
  } else if (i === 1) {
    // pistol
    b.rect(14, 5, 22, 5, body);
    b.hline(14, 35, 5, lit);
    b.rect(16, 10, 6, 8, wood);
    b.rect(22, 10, 4, 3, dark);
    b.rect(35, 6, 3, 3, dark);
  } else if (i === 2) {
    // mg: stock, receiver, perforated jacket, folded bipod, drum
    b.rect(2, 8, 10, 6, wood);
    b.rect(12, 6, 14, 6, body);
    b.hline(12, 25, 6, lit);
    b.rect(26, 7, 16, 4, dark);
    for (let x = 27; x < 41; x += 3) b.set(x, 8, INK);
    b.rect(42, 8, 5, 2, body);
    b.rect(16, 12, 6, 5, dark);
    b.line(30, 11, 38, 15, dark);
  } else {
    // chaingun: housing, six barrels, handle, belt
    b.rect(4, 5, 16, 10, body);
    b.hline(4, 19, 5, lit);
    b.rect(8, 2, 8, 3, dark);
    for (let k = 0; k < 3; k++) b.rect(20, 6 + k * 3, 24, 2, k === 1 ? lit : dark);
    b.rect(24, 5, 2, 10, dark);
    b.rect(38, 5, 2, 10, dark);
    for (let x = 5; x < 15; x += 2) b.rect(x, 15, 1, 4, PAL.brass[2]);
  }
  // ink outline
  const src = b.data.slice();
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 48; x++) {
      if ((src[y * 48 + x] & 255) !== 0) continue;
      const n = (x > 0 && (src[y * 48 + x - 1] & 255) !== 0) || (x < 47 && (src[y * 48 + x + 1] & 255) !== 0) || (y > 0 && (src[(y - 1) * 48 + x] & 255) !== 0) || (y < 19 && (src[(y + 1) * 48 + x] & 255) !== 0);
      if (n) b.data[y * 48 + x] = INK;
    }
  }
  return b.touch();
}

/** A bit key, upright (bow at the top). */
export function keyIcon(gold: boolean): PixelBuffer {
  const b = new PixelBuffer(8, 14);
  const r = gold ? PAL.gold : [PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[2]];
  b.circle(3.5, 3, 3, r[1]);
  b.circle(3.5, 3, 3, r[0], false);
  b.rect(3, 2, 2, 2, INK);
  b.set(2, 1, r[3]);
  b.rect(3, 6, 2, 7, r[2]);
  b.vline(3, 6, 12, r[3]);
  b.rect(5, 10, 2, 1, r[1]);
  b.rect(5, 12, 2, 2, r[1]);
  b.set(6, 13, r[0]);
  return b.touch();
}

// ------------------------------------------------------------------------------------ UHD

/**
 * The bar at density d (UHD kit): a brushed navy-steel plate with a lit top edge, grooved block
 * dividers, recessed panels (shadow top / left, a lit lip bottom / right), a brass porthole ring
 * with bolts round a dark glass and domed rivets — the 1× layout, every edge at the same place.
 */
export function barArtHd(d: number): PixelBuffer {
  const c = new HdCanvas(BAR_W, BAR_H, d);
  const plate = c.material({ ramp: PAL_HD.slate, lo: 2, hi: 5, spec: 0.3, shine: 12, dither: 0.15 });
  const deep = c.material({ ramp: PAL_HD.navy, lo: 0, hi: 3, dither: 0.2 });
  const brass = c.material({ ramp: PAL_HD.gold, lo: 1, hi: 6, spec: 1, shine: 24 });
  const bolt = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 5, spec: 0.6, shine: 20 });
  const head = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 0.9, shine: 26 });
  const brushed: Texture = (s) => {
    s.tone += (hash2(Math.floor(s.x / 8), Math.floor(s.y * s.d), 5) - 0.5) * 0.16 + (hash2(Math.floor(s.x * 0.5), Math.floor(s.y * s.d), 6) - 0.5) * 0.05;
  };
  c.box(0, 0, BAR_W, BAR_H, { mat: plate, round: 0, tex: (s) => {
    brushed(s);
    // the lit top edge, the dark bottom edge
    if (s.y < 1) s.ny -= 0.8;
    else if (s.y < 2) s.ny -= 0.35;
    else if (s.y > BAR_H - 2) s.ny += 0.7;
    // block dividers: grooves at x 48, 116, 240, 256
    for (const gx of [48, 116, 240, 256]) {
      const f = s.x - gx;
      if (f >= 0 && f < 2 && s.y > 2 && s.y < BAR_H - 2) {
        s.nx += f < 1 ? 0.8 : -0.6;
        s.dz = -0.4;
      }
    }
  } });
  const recess = (x0: number, y0: number, x1: number, y1: number): void => {
    c.box(x0, y0, x1 - x0 + 1, y1 - y0 + 1, { mat: deep, z: 0.3, tex: (s) => {
      const fx = s.x - x0;
      const fy = s.y - y0;
      // inner walls: the top / left wall in shadow, the bottom / right lip lit
      if (fy < 1.2) {
        s.ny += 0.9;
        s.tone -= 0.3;
      } else if (y1 + 1 - s.y < 1) s.ny -= 0.9;
      if (fx < 1.2) {
        s.nx += 0.9;
        s.tone -= 0.3;
      } else if (x1 + 1 - s.x < 1) s.nx -= 0.9;
      s.tone += (hash2(Math.floor(s.x * 2), Math.floor(s.y * 2), 7) - 0.5) * 0.06;
    } });
  };
  recess(50, 3, 113, 36);
  recess(118, 3, 238, 36);
  recess(243, 4, 253, 20);
  recess(243, 21, 253, 37);
  recess(258, 3, 381, 36);
  c.paint(310, 4, 1, 32, () => PAL_HD.ink[1], 1);
  // the porthole: a brass ring (a rounded torus) round the dark glass
  const cx = 26;
  const cy = 20;
  c.heightField(cx - 20, 0, 40, BAR_H, (x, y) => {
    const r = Math.hypot(x - cx, y - cy);
    if (r < 16.5 || r > 19.6) return NaN;
    const t = (r - 18) / 1.6;
    return Math.sqrt(Math.max(0, 1 - t * t)) * 1.8;
  }, { mat: brass, z: 1 });
  c.heightField(cx - 17, cy - 17, 34, 34, (x, y) => {
    const r = Math.hypot(x - cx, y - cy);
    if (r > 16.6) return NaN;
    return r > 16 ? -0.4 : 0;
  }, { mat: deep, z: 0.2, tone: -0.4 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    c.ellipsoid(cx + Math.cos(a) * 18.2, cy + Math.sin(a) * 18.2, 0.8, 0.8, { mat: bolt, z: 3 });
  }
  // rivets along the plate
  for (let x = 60; x < BAR_W - 4; x += 32) {
    if (x > 112 && x < 120) continue;
    c.ellipsoid(x + 1, 2, 0.9, 0.9, { mat: head, z: 1 });
  }
  for (const x of [114, 241, 254]) {
    c.ellipsoid(x + 1, 5, 0.9, 0.9, { mat: head, z: 1 });
    c.ellipsoid(x + 1, 35, 0.9, 0.9, { mat: head, z: 1 });
  }
  c.ellipsoid(BAR_W - 2, 5, 0.9, 0.9, { mat: head, z: 1 });
  c.ellipsoid(BAR_W - 2, 35, 0.9, 0.9, { mat: head, z: 1 });
  return c.render({ outline: 'none', ao: 0.35, shadow: 0.3, shadowMax: 2 }).touch();
}

/** The weapon silhouettes at density d (side view, muzzle right): lit steel, wood and brass, outline A. */
export function weaponIconHd(i: number, d: number): PixelBuffer {
  const c = new HdCanvas(48, 20, d);
  const steel = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, spec: 0.8, shine: 22 });
  const dark = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 4, spec: 0.6, shine: 18 });
  const wood = c.material({ ramp: PAL_HD.wood, lo: 2, hi: 6, spec: 0.2, shine: 14 });
  const brass = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 1, shine: 24 });
  const blade = c.material({ ramp: PAL_HD.snow, lo: 1, hi: 5, spec: 1, shine: 34 });
  const grain: Texture = (s) => (s.tone += (hash2(Math.floor(s.x * 0.5), Math.floor(s.y * s.d), 9) - 0.5) * 0.2);
  if (i === 0) {
    // knife: a wooden grip, a guard, a tapering blade with a lit spine
    c.box(6, 9, 10, 3, { mat: wood, bevel: 0.8, r: 0.6, tex: grain });
    c.box(16, 7, 2, 7, { mat: dark, z: 1, bevel: 0.5 });
    c.poly([[18, 8.2], [42, 10], [18, 12]], { mat: blade, z: 0.5, n: [0, 0.15, 0.99] });
    c.poly([[18, 8.2], [42, 10], [18, 9.6]], { mat: blade, z: 0.6, n: [0, -0.5, 0.87] });
  } else if (i === 1) {
    // pistol: the slide, the grip, the trigger guard
    c.box(14, 5, 22, 5, { mat: steel, bevel: 0.8, r: 0.4 });
    c.box(16, 10, 6, 8, { mat: wood, z: -0.2, bevel: 0.8, r: 0.6, tex: grain, n: [-0.15, 0, 0.99] });
    c.box(22, 10, 4, 3, { mat: dark, z: -0.3, bevel: 0.5 });
    c.box(35, 6, 3, 3, { mat: dark, z: 0.2, bevel: 0.5 });
    for (let x = 27; x < 34; x += 1.5) c.paint(x, 5.6, 0.5, 3, () => PAL_HD.steel[2], 2);
  } else if (i === 2) {
    // mg: stock, receiver, perforated jacket, folded bipod, drum
    c.box(2, 8, 10, 6, { mat: wood, bevel: 1, r: 0.8, tex: grain });
    c.box(12, 6, 14, 6, { mat: steel, z: 0.5, bevel: 0.8 });
    c.cylinder(26, 7, 16, 4, { mat: dark, axis: 'h', z: 0.4 });
    c.paint(26, 7, 16, 4, (x, y) => (Math.abs(((x - 27.5) % 3) - 0) < 0.6 && Math.abs(y - 9) < 0.6 ? PAL_HD.ink[0] : 0), 3);
    c.cylinder(42, 8, 5, 2, { mat: steel, axis: 'h', z: 0.6 });
    c.box(16, 12, 6, 5, { mat: dark, z: 0.3, bevel: 0.8, r: 0.8 });
    c.capsule(30, 11, 38, 15, 0.5, 0.5, { mat: dark, z: 0.2 });
  } else {
    // chaingun: housing, six barrels, handle, belt
    c.box(4, 5, 16, 10, { mat: steel, bevel: 1.2, r: 1 });
    c.box(8, 2, 8, 3, { mat: dark, z: 0.4, bevel: 0.6, r: 0.6 });
    for (let k = 0; k < 3; k++) c.cylinder(20, 6 + k * 3, 24, 2, { mat: k === 1 ? steel : dark, axis: 'h', z: k === 1 ? 0.6 : 0.3 });
    c.box(24, 5, 2, 10, { mat: dark, z: 1, bevel: 0.5 });
    c.box(38, 5, 2, 10, { mat: dark, z: 1, bevel: 0.5 });
    for (let x = 5; x < 15; x += 2) c.capsule(x + 0.5, 15.2, x + 0.5, 18.5, 0.5, 0.45, { mat: brass, z: 0.2 });
  }
  return c.render({ outline: 'A', ao: 0.3, rimLight: 1 }).touch();
}

/** A bit key at density d, upright: a ring bow, the shaft and the bit (gold / silver), outline A. */
export function keyIconHd(gold: boolean, d: number): PixelBuffer {
  const c = new HdCanvas(8, 14, d);
  const m = c.material(gold ? { ramp: PAL_HD.gold, lo: 1, hi: 6, spec: 1, shine: 24 } : { ramp: PAL_HD.steel, lo: 3, hi: 7, spec: 1, shine: 26 });
  c.heightField(0, 0, 8, 7, (x, y) => {
    const r = Math.hypot(x - 3.75, y - 3.25);
    if (r > 3.1 || r < 1.1) return NaN;
    const t = (r - 2.1) / 1;
    return Math.sqrt(Math.max(0, 1 - t * t));
  }, { mat: m });
  c.cylinder(3, 6, 2, 7.6, { mat: m, z: 0.2 });
  c.box(5, 10, 2, 1, { mat: m, z: 0.2, bevel: 0.3 });
  c.box(5, 12, 2, 1.8, { mat: m, z: 0.2, bevel: 0.3 });
  return c.render({ outline: 'A', ao: 0.25 }).touch();
}

defineSprite('fps/hud/bar', () => barArt(), { anchor: 'top-left', hd: (d) => barArtHd(d) });
defineSprite('fps/hud/weapon', () => [0, 1, 2, 3].map((i) => weaponIcon(i)), { anchor: 'top-left', hd: (d) => [0, 1, 2, 3].map((i) => weaponIconHd(i, d)) });
defineSprite('fps/hud/key', () => [keyIcon(true), keyIcon(false)], { anchor: 'top-left', hd: (d) => [keyIconHd(true, d), keyIconHd(false, d)] });
