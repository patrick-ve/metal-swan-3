/**
 * Demo sprites for the sprite tool (so it works before any content exists) and the palette
 * sheet. They double as a visual test of the pixel toolkit and the fonts.
 */
import { ascii } from '../../src/engine/ascii';
import { drawText, getFont } from '../../src/engine/font';
import { PixelBuffer, seededRand } from '../../src/engine/pixel';
import { INK, PAL, RAMP_NAMES, SWATCHES } from '../../src/engine/palette';
import type { SpriteGen, SpriteOpts } from '../../src/engine/sprites';
import { SHEET } from './image';

type Define = (id: string, gen: SpriteGen, opts?: SpriteOpts) => void;

const label = (b: PixelBuffer, s: string, x: number, y: number): void =>
  drawText(b, s, x, y, { color: PAL.steel[3] });

function circlesFrame(): PixelBuffer {
  const b = new PixelBuffer(132, 70);
  label(b, 'circle r0-6 fill / ring', 2, 0);
  let x = 4;
  for (let r = 0; r <= 6; r++) {
    b.circle(x + r, 18, r, PAL.sky[2]);
    b.circle(x + r, 18 + 16, r, PAL.gold[2], false);
    x += r * 2 + 5;
  }
  label(b, 'ellipse box w x h', 2, 44);
  const sizes: [number, number][] = [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [8, 4], [12, 6], [16, 9], [6, 12]];
  x = 2;
  for (const [w, h] of sizes) {
    b.ellipse(x, 54, w, h, PAL.green[3]);
    x += w + 3;
  }
  for (const [w, h] of sizes.slice(5)) {
    b.ellipse(x, 54, w, h, PAL.pink[2], false);
    x += w + 3;
  }
  return b;
}

function polysFrame(): PixelBuffer {
  const b = new PixelBuffer(132, 58);
  b.tri(4, 46, 16, 12, 28, 46, PAL.red[2]);
  // Five-point star (concave).
  const star: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 17 : 7;
    star.push(50 + Math.cos(a) * r, 30 + Math.sin(a) * r);
  }
  b.poly(star, PAL.gold[2]);
  // Arrow and a thin sliver.
  b.poly([[72, 24], [88, 24], [88, 16], [104, 30], [88, 44], [88, 36], [72, 36]], PAL.teal[2]);
  b.poly([[108, 12], [128, 50], [111, 15]], PAL.snow[2]);
  // Outline after fill: outline() hugs the shapes from outside.
  b.outline(INK);
  label(b, 'poly: convex, concave, slivers', 2, 0);
  return b;
}

function bevelFrame(): PixelBuffer {
  const b = new PixelBuffer(136, 62);
  label(b, 'bevel, outline, sphere', 2, 0);
  // Bevelled box (steel, depth 2).
  const box = new PixelBuffer(28, 22).rect(1, 1, 26, 20, PAL.steel[2]).bevel(PAL.steel, { depth: 2 }).outline(INK);
  b.blit(box, 2, 12);
  // Bevelled ball (olive) and rounded rect (red) with different light directions.
  const ball = new PixelBuffer(22, 22).circle(10, 10, 9, PAL.olive[2]).bevel(PAL.olive, { depth: 2 }).outline(INK);
  b.blit(ball, 34, 12);
  const rr = new PixelBuffer(30, 18).roundRect(1, 1, 28, 16, 4, PAL.red[2]).bevel(PAL.red, { light: 'tr', depth: 1 }).outline(INK);
  b.blit(rr, 60, 14);
  const gem = new PixelBuffer(20, 22).poly([[10, 1], [18, 9], [10, 20], [2, 9]], PAL.sky[1]).bevel(PAL.sky, { light: 't', depth: 2 }).outline(INK);
  b.blit(gem, 94, 12);
  // Inner outline + corners variant.
  const plate = new PixelBuffer(24, 16).rect(0, 0, 24, 16, PAL.sand[2]).outline(PAL.sand[0], { inside: true });
  plate.rect(4, 4, 16, 8, PAL.sand[1]);
  b.blit(plate, 2, 40);
  const crate = new PixelBuffer(18, 18).rect(1, 1, 16, 16, PAL.brown[2]).bevel(PAL.brown).outline(INK, { corners: true });
  crate.line(3, 3, 14, 14, PAL.brown[1]).line(14, 3, 3, 14, PAL.brown[1]);
  b.blit(crate, 30, 38);
  // sphere(): banded ball shading with dithered borders.
  const balls = new PixelBuffer(84, 24);
  balls.sphere(11, 11, 10, PAL.olive).sphere(33, 11, 8, PAL.steel, { light: 'tr' });
  balls.sphere(53, 11, 6, PAL.red).sphere(70, 13, 4, PAL.gold, { dither: false }).outline(INK);
  b.blit(balls, 50, 36);
  return b;
}

function limbsFrame(): PixelBuffer {
  const b = new PixelBuffer(132, 58);
  label(b, 'capsule widths 2-6, taper, lines', 2, 0);
  const caps = new PixelBuffer(70, 48);
  for (let w = 2; w <= 6; w++) {
    const x = 4 + (w - 2) * 13;
    caps.capsule(x, 6, x + 6, 38, w, PAL.skinA[2]);
  }
  caps.bevel(PAL.skinA, { light: 'l' }).outline(INK);
  b.blit(caps, 0, 9);
  // Tapered limbs (thigh → calf) with outline.
  const limb = new PixelBuffer(36, 48);
  limb.taper(8, 4, 14, 22, 7, 5, PAL.olive[2]).taper(14, 22, 10, 40, 5, 3, PAL.olive[2]);
  limb.taper(26, 4, 24, 40, 6, 2, PAL.olive[2]);
  limb.bevel(PAL.olive, { light: 'l' }).outline(INK);
  b.blit(limb, 70, 9);
  // Thick lines at several angles.
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * (Math.PI / 2);
    b.thickLine(112, 52, 112 + Math.cos(a) * 16, 52 - Math.sin(a) * 16, i % 2 === 0 ? 1 : 3, PAL.gold[i % 4]);
  }
  return b;
}

function ditherFrame(): PixelBuffer {
  const b = new PixelBuffer(140, 70);
  label(b, 'dither 0-16 / gradients', 2, 0);
  for (let i = 0; i <= 16; i++) {
    b.rect(2 + i * 8, 9, 7, 7, PAL.navy[0]).dither(2 + i * 8, 9, 7, 7, PAL.sky[2], i / 16);
  }
  b.gradient(2, 20, 40, 48, PAL.sky, { reverse: true });
  b.gradient(46, 20, 40, 48, PAL.fire, { dither: 0.5 });
  b.gradient(90, 20, 48, 10, PAL.green, { vertical: false, dither: false });
  b.gradient(90, 32, 48, 10, PAL.purple, { vertical: false });
  // Gradient clipped to a shape (via `only`), seeded noise, then an outline.
  const coin = new PixelBuffer(25, 25).circle(12, 12, 11, 1);
  coin.gradient(0, 0, 25, 25, PAL.gold, { only: 1, reverse: true });
  coin.noise(seededRand(7), { colors: [PAL.gold[3], PAL.fire[6]], density: 0.08, only: 'opaque' });
  b.blit(coin.padded(1).outline(INK), 100, 44);
  return b;
}

function emblemFrame(): PixelBuffer {
  // A hand-made grenade icon from text rows.
  const icon = ascii(
    `
    ....kkk....
    ...kSsSk...
    ..kkkkkkk..
    .kOOOOOOOk.
    kOoOOoOOoOk
    kOOOOOOOOOk
    kOoOOoOOoOk
    kOOOOOOOOOk
    .kOoOOoOOk.
    ..kOOOOOk..
    ...kkkkk...
    `,
    { k: INK, S: PAL.steel[3], s: PAL.steel[1], O: PAL.olive[2], o: PAL.olive[1] },
  );
  const b = new PixelBuffer(60, 26);
  label(b, 'ascii()', 2, 0);
  b.blit(icon, 2, 11);
  b.blit(icon.scaled(1).flipped(false, true), 18, 11);
  b.blit(icon.clone().recolor(new Map([[PAL.olive[2], PAL.red[2]], [PAL.olive[1], PAL.red[1]]])), 34, 11);
  return b;
}

function charset(font: 'small' | 'big', perLine: number): PixelBuffer {
  const f = getFont(font);
  const chars = f.glyphs.map((g) => String.fromCodePoint(g.code));
  const lines: string[] = [];
  for (let i = 0; i < chars.length; i += perLine) lines.push(chars.slice(i, i + perLine).join(font === 'big' ? ' ' : ' '));
  const text = lines.join('\n');
  const b = new PixelBuffer(font === 'big' ? 300 : 200, lines.length * f.lineHeight + 14);
  label(b, `font '${font}'`, 0, 0);
  drawText(b, text, 0, 12, { font, color: PAL.snow[3] });
  return b;
}

function styledFrame(): PixelBuffer {
  const b = new PixelBuffer(220, 96);
  b.gradient(0, 0, 220, 96, PAL.navy, { reverse: false });
  drawText(b, 'METAL SWAN 3', 110, 4, { font: 'big', color: PAL.gold[2], outline: INK, shadow: PAL.red[1], align: 'center' });
  drawText(b, 'MISSION 1  START!', 110, 20, { font: 'big', color: PAL.snow[3], shadow: INK, align: 'center' });
  drawText(b, 'The quick brown fox jumps over the lazy dog.', 4, 36, { color: PAL.snow[2] });
  drawText(b, 'Sphinx of black quartz, judge my vow? 0123456789', 4, 46, { color: PAL.sky[2], shadow: INK });
  drawText(b, 'left', 4, 58, { color: PAL.green[3], outline: INK });
  drawText(b, 'center', 110, 58, { color: PAL.green[3], outline: INK, align: 'center' });
  drawText(b, 'right', 216, 58, { color: PAL.green[3], outline: INK, align: 'right' });
  drawText(b, '← ↑ → ↓  ∞  © 2026  ×3  ♥ ★  50%', 4, 70, { color: PAL.pink[2] });
  drawText(b, 'LIVES ×3   BOMBS 10   AMMO ∞', 4, 82, { color: PAL.gold[3], outline: INK });
  return b;
}

/** A small walking-blob strip with a hip and muzzle point per frame (shows marks). */
function animFrames(): { frames: PixelBuffer[]; pts: Record<string, [number, number]>[] } {
  const frames: PixelBuffer[] = [];
  const pts: Record<string, [number, number]>[] = [];
  for (let i = 0; i < 8; i++) {
    const bob = [0, 1, 2, 1, 0, 1, 2, 1][i];
    const b = new PixelBuffer(24, 24);
    const legA = Math.round(Math.sin((i / 8) * Math.PI * 2) * 4);
    b.capsule(10 + legA, 15, 10 + legA, 22, 3, PAL.olive[1]);
    b.capsule(13 - legA, 15, 13 - legA, 22, 3, PAL.olive[2]);
    b.ellipse(5, 5 + bob, 14, 12, PAL.olive[2]).bevel(PAL.olive, { only: PAL.olive[2] });
    b.rect(15, 9 + bob, 8, 2, PAL.steel[2]);
    b.outline(INK);
    frames.push(b);
    pts.push({ hip: [0, -9 + bob], muzzle: [11, -14 + bob] });
  }
  return { frames, pts };
}

/** A small rocket, rotated in 16 directions (row 1: smooth RotSprite-style, row 2: fast). */
function rotationsFrame(): PixelBuffer {
  const rocket = new PixelBuffer(17, 7);
  rocket.capsule(3, 3, 12, 3, 5, PAL.steel[3]).bevel(PAL.steel, { light: 't' });
  rocket.tri(13, 1, 16, 3, 13, 5, PAL.red[2]);
  rocket.rect(0, 1, 3, 5, PAL.red[1]).set(1, 3, PAL.gold[3]);
  const b = new PixelBuffer(16 * 24 + 4, 60);
  label(b, 'rotated(): smooth / fast, 16 directions', 2, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    for (const [row, quality] of [[0, 'smooth'], [1, 'fast']] as const) {
      const r = rocket.rotated(a, { quality }).padded(1).outline(INK);
      b.blit(r, 2 + i * 24 + 12 - (r.w >> 1), 12 + row * 24 + 12 - (r.h >> 1));
    }
  }
  return b;
}

/** Registers the demo sprites; `withBroken` adds 'demo/broken' (a throwing generator). */
export function registerDemoSprites(define: Define, withBroken = false): void {
  define('demo/rotations', () => rotationsFrame(), { anchor: 'top-left' });
  define('demo/shapes', () => [circlesFrame(), polysFrame(), bevelFrame(), limbsFrame(), ditherFrame(), emblemFrame()], {
    anchor: 'top-left',
  });
  define('demo/font', () => [charset('small', 24), charset('big', 20), styledFrame()], { anchor: 'top-left' });
  const anim = animFrames();
  define('demo/anim', () => anim.frames, { anchor: 'feet', pts: anim.pts, ticksPerFrame: 5 });
  if (withBroken) {
    define('demo/broken', () => {
      throw new Error('demo of a failing generator');
    });
  }
}

/** Palette sheet: every ramp with a shaded preview, then all unique swatches with names. */
export function paletteSheet(): PixelBuffer {
  const W = 368;
  const rowH = 16;
  const sw = 18;
  const gridCols = 8;
  const cellW = 45;
  const cellH = 24;
  const gridRows = Math.ceil(SWATCHES.length / gridCols);
  const H = 30 + RAMP_NAMES.length * rowH + 14 + gridRows * cellH + 8;
  const b = new PixelBuffer(W, H).fill(SHEET.bg);
  drawText(b, 'PALETTE', 8, 6, { font: 'big', color: SHEET.title, shadow: 0x000000ff });
  drawText(b, `${SWATCHES.length} colours, ${RAMP_NAMES.length} ramps (dark → light)`, W - 8, 7, {
    color: SHEET.dim,
    align: 'right',
  });
  let y = 26;
  for (const name of RAMP_NAMES) {
    const r = PAL[name];
    drawText(b, name, 8, y + 4, { color: SHEET.label });
    r.forEach((c, i) => b.rect(56 + i * sw, y + 1, sw, rowH - 2, c));
    // Shaded previews: a ball (depth 2) and a box (depth 1), outlined in ink.
    const ball = new PixelBuffer(15, 15).circle(7, 7, 6, 1).bevel(r, { depth: 2 }).outline(INK);
    b.blit(ball, 56 + 7 * sw + 10, y);
    const box = new PixelBuffer(26, 15).rect(1, 1, 24, 13, 1).bevel(r, { depth: 1 }).outline(INK);
    b.blit(box, 56 + 7 * sw + 30, y);
    const grad = new PixelBuffer(60, 13).gradient(0, 0, 60, 13, r, { vertical: false });
    b.blit(grad, 56 + 7 * sw + 62, y + 1);
    y += rowH;
  }
  y += 10;
  SWATCHES.forEach((s, i) => {
    const cx = 8 + (i % gridCols) * cellW;
    const cy = y + Math.floor(i / gridCols) * cellH;
    b.rect(cx, cy, cellW - 4, 10, s.color);
    drawText(b, s.name, cx, cy + 12, { color: SHEET.label });
  });
  return b;
}
