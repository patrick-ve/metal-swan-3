/**
 * The Amsterdam locals' riders have no UHD art any more (docs/design/ams40.md rule 7): every rider
 * is a baked 40 px set drawn as its 1× frames at every art tier — the delivery rider
 * (tests/art40/delivery-rider.test.ts), the fatbike youth look 0 (tests/art40/fatbike-youth.test.ts),
 * the looks 1–3 and the pairs (tests/art40/fatbike-youth-looks.test.ts); the herring gull too
 * (tests/art40/seagull.test.ts). What is left of rider.hd.ts is the shared box helper `onBox`.
 */
import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { denseTarget, getFrames, hasHiSprite, listSprites } from '../../src/engine/sprites';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { onBox, onBoxes } from '../../src/game/content/locals/rider.hd';
import { duplicateFrames } from '../art/motion';

const RIDERS = ['enemy/fatbike-youth', 'enemy/delivery-rider'];

describe('locals: the riders are 1× only', () => {
  it('no rider id has a 2× / 4× generator or a dense alias; every tier draws the 1× frames', () => {
    const ids = listSprites().filter((id) => RIDERS.some((p) => id.startsWith(p)));
    expect(ids.length).toBeGreaterThan(500);
    for (const id of ids) {
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id}@${d}`).toBe(false);
        expect(denseTarget(id, d), `${id}@${d}`).toBe(id);
        expect(getFrames(id, d), `${id}@${d}`).toBe(getFrames(id, 1));
      }
    }
  });

  it('no two consecutive frames are identical (a look and a pair)', () => {
    for (const set of ['enemy/fatbike-youth-2b', 'enemy/fatbike-youth-pair-3c']) {
      for (const n of ['ride', 'idle', 'kick', 'tell', 'turn', 'die-seat', 'get-up']) expect(duplicateFrames(`${set}/${n}`, 1), `${set}/${n}`).toEqual([]);
    }
  });
});

describe('rider.hd: onBox', () => {
  it('cuts a dense frame to the box of its 1× frame (anchor and points of the 1× frame)', () => {
    const lo: Frame = { buf: new PixelBuffer(3, 2), ox: 1, oy: 2, pts: { hand: [1, -1] } };
    const hi = new PixelBuffer(10, 8);
    hi.set(2, 2, 0xff0000ff);
    const f: Frame = { buf: hi, ox: 2, oy: 3 };
    const out = onBox(f, lo, 2);
    expect([out.buf.w, out.buf.h, out.ox, out.oy, out.density]).toEqual([6, 4, 1, 2, 2]);
    expect(out.pts).toEqual({ hand: [1, -1] });
    expect(out.buf.get(0, 0)).toBe(0xff0000ff);
    expect(onBoxes([f, f], [lo, lo], 2)).toHaveLength(2);
  });
});
