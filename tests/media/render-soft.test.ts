import { describe, expect, it } from 'vitest';
import { getFont } from '../../src/engine/font';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { defineSprite } from '../../src/engine/sprites';
import { mask } from './util';

const R = 0xff0000ff;
const G = 0x00ff00ff;
const K = 0x000000ff;
const W = 0xffffffff;

/** 4×2 frame: left column red, the rest green; feet anchor (2, 2). */
function frame(): Frame {
  const b = new PixelBuffer(4, 2).fill(G);
  b.vline(0, 0, 1, R);
  return { buf: b, ox: 2, oy: 2 };
}

function renderer(w = 24, h = 16): SoftRenderer {
  const r = new SoftRenderer(w, h);
  r.begin(K);
  return r;
}

describe('SoftRenderer', () => {
  it('clears to black by default and keeps the image with null', () => {
    const r = new SoftRenderer(4, 4);
    r.begin();
    expect(r.target.get(0, 0)).toBe(K);
    r.rect(0, 0, 1, 1, W);
    r.begin(null);
    expect(r.target.get(0, 0)).toBe(W);
  });

  it('places frames by anchor and rounds the camera', () => {
    const r = renderer();
    r.setCamera(2.6, 1.4);
    expect([r.camX, r.camY]).toEqual([3, 1]);
    r.frame(frame(), 13.4, 11);
    // left = round(13.4) − 3 − ox = 8, top = 11 − 1 − oy = 8
    expect(r.target.get(8, 8)).toBe(R);
    expect(r.target.get(11, 9)).toBe(G);
    expect(r.target.get(7, 8)).toBe(K);
    expect(r.target.get(12, 8)).toBe(K);
  });

  it('mirrors around the anchor pixel when flipped', () => {
    const r = renderer();
    r.frame(frame(), 10, 10, { flipX: true });
    // left = 10 − (4 − 1 − 2) = 9; the red column is now on the right.
    expect(r.target.get(12, 8)).toBe(R);
    expect(r.target.get(9, 8)).toBe(G);
    expect(r.target.get(8, 8)).toBe(K);
    const v = renderer();
    v.frame(frame(), 10, 10, { flipY: true });
    // top = 10 − (2 − 1 − 2) = 11
    expect(v.target.get(8, 11)).toBe(R);
    expect(v.target.get(8, 10)).toBe(K);
  });

  it('draws flash silhouettes, alpha and additive blends', () => {
    const r = renderer();
    r.frame(frame(), 10, 10, { flash: true });
    expect(r.target.get(8, 8)).toBe(W);
    const a = renderer();
    a.frame(frame(), 10, 10, { alpha: 0.5 });
    expect(a.target.get(9, 8)).toBe(0x008000ff);
    const add = renderer();
    add.rect(0, 0, 4, 4, 0x404040ff);
    add.rect(0, 0, 4, 4, 0x404040ff, { blend: 'add' });
    expect(add.target.get(1, 1)).toBe(0x808080ff);
  });

  it('tints silhouettes and tints solid shapes', () => {
    const r = renderer();
    r.frame(frame(), 10, 10, { tint: R });
    expect(r.target.get(9, 8)).toBe(R);
    r.rect(0, 0, 2, 2, G, { tint: W });
    expect(r.target.get(1, 1)).toBe(W);
    r.rect(3, 0, 2, 2, G, { tint: R, flash: true });
    expect(r.target.get(3, 0)).toBe(R);
  });

  it('draws sub-rectangles in place, also when flipped', () => {
    // Column 0 of the frame is red; draw only that column.
    const r = renderer();
    r.frame(frame(), 10, 10, { src: { x: 0, y: 0, w: 1, h: 2 } });
    expect(r.target.get(8, 8)).toBe(R);
    expect(r.target.get(9, 8)).toBe(K);
    const f = renderer();
    f.frame(frame(), 10, 10, { src: { x: 0, y: 0, w: 1, h: 2 }, flipX: true });
    // Flipped, column 0 lands on the right edge (x 12), exactly where the full flip puts it.
    expect(f.target.get(12, 8)).toBe(R);
    expect(f.target.get(11, 8)).toBe(K);
    const clipped = renderer();
    clipped.frame(frame(), 10, 10, { src: { x: -5, y: 1, w: 50, h: 9 } });
    expect(clipped.target.get(8, 9)).toBe(R);
    expect(clipped.target.get(8, 8)).toBe(K);
  });

  it('respects screen space for HUD drawing', () => {
    const r = renderer();
    r.setCamera(100, 50);
    r.rect(2, 3, 2, 2, W, { screen: true });
    r.rect(102, 53, 1, 1, R);
    expect(r.target.get(2, 3)).toBe(R);
    expect(r.target.get(3, 4)).toBe(W);
  });

  it('draws sprites by id (frame index wraps)', () => {
    defineSprite('soft/dot', () => [new PixelBuffer(1, 1).fill(R), new PixelBuffer(1, 1).fill(G)], { anchor: 'top-left' });
    const r = renderer();
    r.sprite('soft/dot', 3, 5, 5);
    expect(r.target.get(5, 5)).toBe(G);
  });

  it('draws images top-left, with flips in place', () => {
    const r = renderer();
    r.image(frame().buf, 1, 1, { flipX: true });
    expect(r.target.get(4, 1)).toBe(R);
    expect(r.target.get(1, 1)).toBe(G);
  });

  it('tiles parallax layers from the rounded origin', () => {
    const layer = new PixelBuffer(10, 2);
    for (let x = 0; x < 10; x++) layer.vline(x, 0, 1, 0x000000ff | (x << 24));
    const r = renderer(24, 4);
    r.setCamera(7, 0);
    r.parallax(layer, 0.5, 0, 0, 1);
    // origin = round(0 − 3.5) = −3 → screen x 0 shows column 3; tiles repeat every 10 px.
    expect(r.target.get(0, 1) >>> 24).toBe(3);
    expect(r.target.get(7, 1) >>> 24).toBe(0);
    expect(r.target.get(17, 2) >>> 24).toBe(0);
    expect(r.target.get(5, 0)).toBe(K);
    const once = renderer(24, 4);
    once.parallax(layer, 0, 0, 20, 0, { repeatX: false });
    expect(once.target.get(19, 0)).toBe(K);
    expect(once.target.get(21, 0) >>> 24).toBe(1);
    expect(once.target.get(1, 0)).toBe(K);
  });

  it('draws lines and fades', () => {
    const r = renderer(8, 4);
    r.line(0, 0, 4, 2, W);
    expect(mask(r.target.clone().replace(K, 0), 0, 0, 5, 3)).toEqual(['#....', '.##..', '...##']);
    r.fade(W, 1);
    expect(r.target.get(7, 3)).toBe(W);
  });

  it('clips absurdly long lines without changing short ones', () => {
    const r = renderer(16, 16);
    r.line(-1e9, 8, 1e9, 8, W);
    expect(r.target.get(0, 8)).toBe(W);
    expect(r.target.get(15, 8)).toBe(W);
    expect(r.target.get(8, 7)).toBe(K);
    r.line(-1e9, -1e9, -1e9 + 5000, -1e9, W); // far away: nothing
  });

  it('draws text in screen space by default, world space on request', () => {
    const r = renderer(40, 12);
    r.setCamera(10, 0);
    r.text('I', 1, 1, { color: W });
    expect(r.target.get(1, 1)).toBe(W);
    r.begin(K);
    r.text('I', 11, 1, { color: R, screen: false });
    expect(r.target.get(1, 1)).toBe(R);
    const w = getFont('small').glyph(73).w;
    r.begin(K);
    r.text('I', 20, 1, { color: W, align: 'right' });
    expect(r.target.get(20 - w, 1)).toBe(W);
    expect(r.target.get(20, 1)).toBe(K);
  });
});
