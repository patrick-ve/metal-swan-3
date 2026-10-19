/**
 * Draw calls shared by the renderer parity test: node runs them on SoftRenderer, Chromium on
 * CanvasRenderer, and the images are compared.
 */
import { PixelBuffer } from '../../../src/engine/pixel';
import { INK, PAL } from '../../../src/engine/palette';
import type { Renderer } from '../../../src/engine/render';
import { defineHdSprite, defineHiSprite, defineSprite, withArtDensity } from '../../../src/engine/sprites';

let registered = false;

export function registerSceneSprites(): void {
  if (registered) return;
  registered = true;
  defineSprite('parity/hero', () =>
    [0, 1].map((i) => {
      const b = new PixelBuffer(21, 26);
      b.capsule(7, 16, 6 + i * 2, 25, 4, PAL.olive[1]).capsule(13, 16, 14 - i * 2, 25, 4, PAL.olive[2]);
      b.roundRect(4, 6, 13, 12, 3, PAL.olive[2]).bevel(PAL.olive, { only: PAL.olive[2] });
      b.circle(10, 4, 3, PAL.skinA[2]);
      b.rect(14, 10, 7, 2, PAL.steel[2]);
      b.outline(INK);
      return { buf: b, ox: 10, oy: 26, pts: { muzzle: [10, -15] } };
    }),
  );
  defineSprite(
    'parity/glow',
    () => {
      const b = new PixelBuffer(24, 24);
      b.circle(12, 12, 11, 0xff600060).circle(12, 12, 7, 0xffa040a0).circle(12, 12, 3, PAL.gold[3]);
      return b;
    },
    { anchor: 'center' },
  );
  // 2× art: a 1× hero and a detailed 2× version (density 2) with single-pixel detail.
  defineSprite('parity/hero2', () => new PixelBuffer(12, 16).roundRect(1, 1, 10, 14, 3, PAL.olive[2]).outline(INK), { pts: { muzzle: [5, -10] } });
  defineHiSprite('parity/hero2', () => {
    const b = new PixelBuffer(24, 32).roundRect(2, 2, 20, 28, 6, PAL.olive[2]).bevel(PAL.olive, { only: PAL.olive[2] });
    for (let y = 4; y < 28; y += 3) for (let x = 4 + (y % 2); x < 20; x += 3) b.set(x, y, PAL.gold[3]);
    b.set(5, 5, PAL.red[2]);
    b.set(18, 7, PAL.sky[2]);
    return b.outline(INK);
  });
  // UHD art: one density-generic generator for 2× and 4× (single art-pixel detail at each d).
  defineSprite('parity/hero4', () => new PixelBuffer(10, 14).roundRect(1, 1, 8, 12, 2, PAL.steel[2]).outline(INK), { pts: { muzzle: [4, -9] } });
  defineHdSprite('parity/hero4', (d) => {
    const b = new PixelBuffer(10 * d, 14 * d).roundRect(d, d, 8 * d, 12 * d, 2 * d, PAL.steel[2]).bevel(PAL.steel, { only: PAL.steel[2] });
    for (let y = 2 * d; y < 12 * d; y += d + 1) for (let x = 2 * d + (y % 3); x < 8 * d; x += d + 1) b.set(x, y, PAL.gold[3]);
    b.set(2 * d + 1, 2 * d + 1, PAL.red[2]);
    b.set(7 * d, 3 * d + d - 1, PAL.sky[2]);
    return b.outline(INK);
  });
}

/**
 * 4× art (density 4) drawn only where the image is exact (4 | k, or k ≤ 2: the reduction to 2× or
 * 1×), so the 2× checks at res 3, 5 and 6 keep their own tolerance.
 */
function drawHdRow(r: Renderer): void {
  const k = r.res;
  if (!(k % 4 === 0 || k <= 2)) return;
  withArtDensity(4, () => {
    r.sprite('parity/hero4', 0, 40, 180);
    r.sprite('parity/hero4', 0, 70.4, 180, { flipX: true });
    r.sprite('parity/hero4', 0, 100, 180, { flipY: true, flash: true });
    r.sprite('parity/hero4', 0, 130.5, 180.5, { tint: PAL.red[2], flipX: true, flipY: true });
    r.sprite('parity/hero4', 0, 160, 190, { screen: true });
    for (let row = 0; row < 14; row += 2) {
      const shift = Math.round(Math.sin(row * 0.9) * 2);
      r.sprite('parity/hero4', 0, 200 + shift, 180, { src: { x: 0, y: row, w: 10, h: 2 }, flipX: row % 4 === 0 });
    }
    r.sprite('parity/hero4', 0, 240, 180, { src: { x: 2, y: -2, w: 6, h: 30 }, flipY: true });
  });
}

/**
 * 2× art (density 2) next to its 1× frames: exact where 2 divides res, nearest ties elsewhere;
 * plus a row of 4× art at res 1, 2, 4 and 8 (`drawHdRow`).
 */
export function drawHiScene(r: Renderer): void {
  registerSceneSprites();
  r.begin(PAL.navy[0]);
  r.setCamera(13.4, 2.6);
  r.sprite('parity/hero2', 0, 40, 100);
  withArtDensity(2, () => {
    r.sprite('parity/hero2', 0, 70, 100);
    r.sprite('parity/hero2', 0, 100.6, 100, { flipX: true });
    r.sprite('parity/hero2', 0, 130, 100, { flipY: true, flash: true });
    r.sprite('parity/hero2', 0, 160.5, 100.5, { tint: PAL.red[2], flipX: true, flipY: true });
    r.sprite('parity/hero2', 0, 200, 60, { screen: true });
    for (let row = 0; row < 16; row += 2) {
      const shift = Math.round(Math.sin(row * 0.7) * 2);
      r.sprite('parity/hero2', 0, 240 + shift, 100, { src: { x: 0, y: row, w: 12, h: 2 }, flipX: row % 4 === 0 });
    }
    r.sprite('parity/hero2', 0, 280, 100, { src: { x: 3, y: -2, w: 7, h: 30 }, flipY: true });
  });
  drawHdRow(r);
  r.end();
}

function sky(): PixelBuffer {
  return new PixelBuffer(64, 120).gradient(0, 0, 64, 120, PAL.sky, { reverse: true });
}

function hills(): PixelBuffer {
  const b = new PixelBuffer(96, 60);
  b.poly([[0, 59], [0, 30], [20, 12], [44, 34], [70, 8], [95, 30], [95, 59]], PAL.green[2]);
  return b.bevel(PAL.green, { light: 't', depth: 2 });
}

function icon(): PixelBuffer {
  const b = new PixelBuffer(16, 12).rect(1, 1, 14, 10, PAL.red[2]).bevel(PAL.red).outline(INK);
  b.set(2, 2, PAL.gold[3]);
  return b;
}

/** Only opaque drawing: both renderers must agree exactly. */
export function drawOpaqueScene(r: Renderer): void {
  registerSceneSprites();
  r.begin(PAL.navy[0]);
  r.setCamera(13.4, 2.6);
  r.parallax(sky(), 0.25, 0, 0, 0);
  r.parallax(hills(), 0.5, 0, 7, 110);
  r.sprite('parity/hero', 0, 60, 150);
  r.sprite('parity/hero', 1, 100.6, 150, { flipX: true });
  r.sprite('parity/hero', 0, 140, 150, { flash: true });
  r.sprite('parity/hero', 1, 180, 150, { flipY: true });
  r.sprite('parity/hero', 1, 220.5, 150, { flipX: true, flipY: true, flash: true });
  r.sprite('parity/hero', 0, 3, 150);
  r.sprite('parity/missing', 0, 330, 150);
  r.image(icon(), 300, 20, { flipX: true });
  r.image(icon(), 380, 200, { screen: true });
  r.rect(10, 180, 50, 10, PAL.red[2]);
  r.rect(5, 5, 3, 3, PAL.gold[2], { screen: true, flash: true });
  r.line(0, 0, 383, 215, PAL.gold[2], { screen: true });
  r.line(200, 10, 200, 100, PAL.snow[3]);
  r.line(10, 100, 120, 60, PAL.pink[1]);
  r.line(250, 40, 340, 41, PAL.teal[2]);
  r.text('PARITY 123 ←→', 192, 8, { font: 'big', align: 'center', color: PAL.gold[2], outline: INK, shadow: PAL.red[1] });
  r.text('small text, world space', 40, 90, { screen: false, color: PAL.snow[2] });
  r.text('right\naligned ©∞', 380, 190, { align: 'right', shadow: INK });
  // Tints, sub-rectangles (heat-haze slices) with flips, scaled text.
  r.sprite('parity/hero', 0, 322, 120, { tint: PAL.red[2] });
  r.sprite('parity/hero', 1, 300, 186, { tint: PAL.sky[2], flipX: true, screen: true });
  for (let row = 0; row < 26; row += 2) {
    const shift = Math.round(Math.sin(row * 0.7) * 2);
    r.sprite('parity/hero', 1, 355 + shift, 150, { src: { x: 0, y: row, w: 21, h: 2 }, flipX: row % 4 === 0 });
  }
  r.image(icon(), 330, 60, { src: { x: 2, y: 3, w: 9, h: 20 }, flipY: true });
  r.text('SWAN 3', 100, 34, { font: 'big', scale: 2, color: PAL.steel[4], outline: INK, shadow: PAL.navy[1] });
  r.text('x3', 60, 70, { scale: 3, color: PAL.gold[2] });
  r.rect(160, 150, 12, 6, PAL.red[2], { tint: PAL.green[3] });
  r.end();
}

/** Alpha, additive and fade drawing: blended pixels may differ by a rounding step. */
export function drawBlendScene(r: Renderer): void {
  registerSceneSprites();
  drawOpaqueScene(r);
  r.sprite('parity/glow', 0, 230, 110, { blend: 'add' });
  r.sprite('parity/glow', 0, 260, 120);
  r.sprite('parity/hero', 1, 290, 150, { alpha: 0.5 });
  r.rect(30, 185, 50, 10, PAL.sky[2], { alpha: 0.5 });
  r.rect(50, 170, 30, 30, 0x40804080, { blend: 'add' });
  r.line(20, 30, 180, 60, PAL.snow[3], { alpha: 0.6 });
  r.text('faded', 300, 60, { alpha: 0.5 });
  r.parallax(icon(), 1, 0, 0, 200, { alpha: 0.3 });
  r.fade(PAL.navy[0], 0.2);
  r.end();
}
