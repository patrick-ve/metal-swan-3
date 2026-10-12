/**
 * `drum-barricade` art (`machine/drum-barricade/…`): an original 32×64 wall of Legion drums held
 * in a crimson timber frame — a bass drum lying on its side at the bottom, two big drums face-on,
 * two snare drums, a top drum and a little Legion pennant, gold bunting across the middle.
 * Feet anchor (bottom centre).
 *
 * Strips: `body` (3f by damage state: intact; ≤ 50 % two skins torn and dents; ≤ 25 % most skins
 * torn, the top drum gone, scorch), `wreck` (a low pile of broken drums), `drum` (4f, centre: a
 * snare drum tumbling away).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { damage } from '../../../art/machines';
import { bayer, Composer, shadeLayer } from '../../../art/paint';
import { BARRICADE } from './geom';
import { bunting, drumHead, fr, PENNANTS } from './kit.art';

const ART = 'machine/drum-barricade';

const W = 42;
const H = 76;
const OX = 21;
const OY = 74;
const X = (dx: number): number => OX + dx;
const Y = (dy: number): number => OY + dy;

/** A marching drum seen side-on: crimson shell, white hoops top and bottom, gold zigzag cords. */
function sideDrum(b: PixelBuffer, x: number, y: number, w: number, h: number, axis: 'v' | 'h'): void {
  b.rect(x, y, w, h, PAL.red[2]);
  const shell = new PixelBuffer(w, h).fill(PAL.red[2]);
  shadeLayer(shell, PAL.red, { hi: 1, lo: 1 });
  b.blit(shell, x, y);
  if (axis === 'v') {
    // Standing: the hoops are the top and bottom bands, the cords zigzag between them.
    b.rect(x, y, w, 2, PAL.snow[2]);
    b.hline(x, x + w - 1, y, PAL.snow[3]);
    b.rect(x, y + h - 2, w, 2, PAL.snow[1]);
    zigzag(b, x + 1, y + 2, w - 2, h - 4);
  } else {
    // Lying on its side: the hoops are the left and right bands.
    b.rect(x, y, 2, h, PAL.snow[3]);
    b.rect(x + w - 2, y, 2, h, PAL.snow[1]);
    zigzag(b, x + 3, y + 1, w - 6, h - 2);
  }
}

/** Gold tension cords zigzagging between two hoops (a V every 6 px) inside the box. */
function zigzag(b: PixelBuffer, x: number, y: number, w: number, h: number): void {
  for (let i = 0; i + 3 <= w - 1; i += 6) {
    b.line(x + i, y, x + i + 3, y + h - 1, PAL.gold[2]);
    b.line(x + i + 3, y + h - 1, Math.min(x + w - 1, x + i + 6), y, PAL.gold[1]);
  }
}

/** The timber frame behind the drums: two posts, a top beam and a cross brace. */
function frameLayer(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const box = BARRICADE.box;
  b.rect(X(box.x), Y(box.y + 2), 3, box.h - 2, PAL.red[1]);
  b.rect(X(box.x + box.w - 3), Y(box.y + 2), 3, box.h - 2, PAL.red[1]);
  b.rect(X(box.x), Y(box.y + 2), box.w, 3, PAL.red[1]);
  b.thickLine(X(box.x + 2), Y(-60), X(box.x + box.w - 3), Y(-4), 2, PAL.red[0]);
  shadeLayer(b, PAL.red, { base: 1, hi: 1, lo: 1 });
  b.hline(X(box.x), X(box.x + box.w - 1), Y(box.y + 2), PAL.gold[2]);
  return b;
}

/** The drums. `state` 1 tears two skins, 2 tears most and drops the top drum. */
function drumsLayer(state: 0 | 1 | 2): PixelBuffer {
  const b = new PixelBuffer(W, H);
  // Bottom: a bass drum lying on its side, the full width.
  sideDrum(b, X(-16), Y(-16), 32, 16, 'h');
  // Two big drums face-on.
  drumHead(b, X(-8), Y(-24), 8, state >= 1, 3);
  drumHead(b, X(8), Y(-24), 8, state >= 2, 5);
  // Two standing snare drums.
  sideDrum(b, X(-15), Y(-44), 14, 12, 'v');
  sideDrum(b, X(1), Y(-44), 14, 12, 'v');
  if (state < 2) {
    // The top drum face-on and a pennant on a stick.
    drumHead(b, X(-2), Y(-52), 7, state >= 1, 9);
    b.vline(X(9), Y(-64), Y(-46), PAL.brown[2]);
    b.tri(X(10), Y(-64), X(10), Y(-58), X(15), Y(-61), PAL.red[2]);
    b.set(X(11), Y(-61), PAL.gold[3]);
  } else {
    // The top drum is gone: a cracked shell lies across the snares.
    b.rect(X(-10), Y(-48), 14, 4, PAL.red[1]);
    b.line(X(-10), Y(-48), X(3), Y(-45), PAL.ink[1]);
  }
  return b;
}

function bodyFrame(state: 0 | 1 | 2): Frame {
  const c = new Composer(W, H);
  c.add(frameLayer(), { ramp: PAL.red });
  c.add(drumsLayer(state), { ramp: PAL.red });
  const dec = new PixelBuffer(W, H);
  bunting(dec, X(-15), X(14), Y(-61), 3, PENNANTS, 6);
  c.paint(dec, PAL.stone[1]);
  let buf = c.finish();
  if (state >= 1) buf = damage(buf, state === 1 ? 1.4 : 3, 61 + state);
  if (state === 2) {
    // Scorch on the lower drums.
    for (let y = -30; y < -2; y++) {
      for (let x = -15; x < 15; x++) {
        const col = buf.get(X(x), Y(y));
        if ((col & 255) === 0 || col === INK) continue;
        if (Math.sin(x * 0.5 + y * 0.31) + Math.cos(y * 0.7) > 1 && bayer(x, y) < 0.6) buf.set(X(x), Y(y), PAL.ink[1]);
      }
    }
  }
  return fr(buf, OX, OY);
}

/** The pile left behind: the squashed bass drum, a broken drum on top, a stray stick. */
function wreckFrame(): Frame {
  const c = new Composer(W, H);
  const b = new PixelBuffer(W, H);
  sideDrum(b, X(-17), Y(-9), 34, 9, 'h');
  c.add(b, { ramp: PAL.red });
  const top = new PixelBuffer(W, H);
  drumHead(top, X(-5), Y(-12), 5, true, 13);
  top.thickLine(X(4), Y(-14), X(12), Y(-10), 2, PAL.brown[2]);
  c.add(top, { ramp: PAL.red });
  const buf = damage(c.finish(), 2, 71);
  return fr(buf, OX, OY);
}

/** A snare drum tumbling away (quarter turns ±45°), centre anchor. */
function drumFrames(): Frame[] {
  const base = new PixelBuffer(16, 14);
  sideDrum(base, 1, 1, 14, 12, 'v');
  const out: Frame[] = [];
  for (let k = 0; k < 4; k++) {
    const r = k === 0 ? base.clone() : base.rotated((k * Math.PI) / 4, { quality: 'fast' });
    const b = new PixelBuffer(r.w + 2, r.h + 2).blit(r, 1, 1).outline(INK);
    out.push(fr(b, b.w >> 1, b.h >> 1));
  }
  return out;
}

export function defineBarricadeSprites(): void {
  defineSprite(`${ART}/body`, () => [bodyFrame(0), bodyFrame(1), bodyFrame(2)], { ticksPerFrame: 30 });
  defineSprite(`${ART}/wreck`, () => [wreckFrame()], { ticksPerFrame: 30 });
  defineSprite(`${ART}/drum`, drumFrames, { ticksPerFrame: 3 });
}
