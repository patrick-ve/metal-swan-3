/**
 * Draw calls shared by the renderer parity test: node runs them on SoftRenderer, Chromium on
 * CanvasRenderer, and the images are compared.
 */
import { PixelBuffer } from '../../../src/engine/pixel';
import { INK, PAL } from '../../../src/engine/palette';
import type { Renderer } from '../../../src/engine/render';
import { defineSprite } from '../../../src/engine/sprites';

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
