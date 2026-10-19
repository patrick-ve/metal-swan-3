/** Anim wave p1 (plan Phase 1): the new player strips and the drop canopy pass the motion gate. */
import { beforeAll, describe, expect, it } from 'vitest';
import { frameCount, getFrames, isDeferredSprite, spriteAnim } from '../../src/engine/sprites';
import { frameH } from '../../src/engine/render';
import { danglePoses, flipPoses, MOUNT_HOP_TIMING } from '../../src/game/art/human-sprites';
import * as P from '../../src/game/art/poses';
import { HERO_STYLES, RECRUIT_STYLE } from '../../src/game/content/characters/art';
import { assertNoDuplicateFrames, assertSmooth } from './motion';

const HEROES = ['recruit', ...Object.keys(HERO_STYLES)];
const STYLES = [RECRUIT_STYLE, ...Object.values(HERO_STYLES)];

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
  // fx/chute registers with the fx art (src/game/content/fx/art.ts imports chute.art).
  await import('../../src/game/content/fx/chute.art');
});

describe('p1 strips: counts, timing, defer', () => {
  it('every hero has the five strips with the planned frames', () => {
    expect(HEROES.length).toBe(10);
    for (const c of HEROES) {
      const pre = `char/${c}/`;
      expect(frameCount(pre + 'flip'), c).toBe(14);
      expect(frameCount(pre + 'mount-hop'), c).toBe(5);
      expect(frameCount(pre + 'legs-dangle'), c).toBe(6);
      expect(frameCount(pre + 'die-drown'), c).toBe(12);
      expect(frameCount(pre + 'die-flat'), c).toBe(7);
      for (const id of ['flip', 'mount-hop', 'die-drown', 'die-flat']) expect(spriteAnim(pre + id).loop, id).toBe(false);
      expect(spriteAnim(pre + 'legs-dangle').loop).not.toBe(false);
      expect((spriteAnim(pre + 'die-drown').durations ?? []).reduce((a, b) => a + b, 0)).toBe(60);
      // Rare strips are deferred; the ones of normal play are not.
      for (const id of ['mount-hop', 'die-drown', 'die-flat']) expect(isDeferredSprite(pre + id), id).toBe(true);
      for (const id of ['flip', 'legs-dangle']) expect(isDeferredSprite(pre + id), id).toBe(false);
    }
    expect(spriteAnim('char/recruit/flip').ticksPerFrame).toBe(2);
    expect(spriteAnim('char/recruit/mount-hop').durations).toEqual(MOUNT_HOP_TIMING);
    expect(frameCount('fx/chute')).toBe(6);
    expect(frameCount('fx/chute-collapse')).toBe(8);
    expect(isDeferredSprite('fx/chute')).toBe(false);
  });

  it('mount-hop ends with a hip point; die-drown has nothing below its anchor (1x and 2x)', () => {
    for (const c of HEROES) {
      const hop = getFrames(`char/${c}/mount-hop`);
      expect(hop[4]?.pts?.hip, c).toBeDefined();
      for (const d of [1, 2]) {
        for (const f of getFrames(`char/${c}/die-drown`, d)) {
          expect(frameH(f), c).toBe(f.oy);
          expect(f.buf.h, c).toBe(f.oy * d);
        }
      }
    }
  });

  it('fx/chute: rim-centre anchor and a harness point, 2x twins with the same geometry', () => {
    for (const id of ['fx/chute', 'fx/chute-collapse']) {
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length).toBe(lo.length);
      lo.forEach((f, i) => {
        expect(f.pts?.harness).toEqual([0, 16]);
        expect(hi[i].ox).toBe(f.ox);
        expect(hi[i].oy).toBe(f.oy);
        expect(hi[i].buf.w).toBe(f.buf.w * 2);
      });
    }
  });
});

describe('p1 strips: motion gate', () => {
  it('flip: one full turn, smooth per displayed tick (every hero style)', () => {
    for (const style of STYLES) {
      const poses = flipPoses(style);
      expect(poses.length).toBe(14);
      expect(poses[0].rot).toBe(0);
      expect(poses[13].rot).toBe(360);
      for (let i = 1; i < 14; i++) expect(poses[i].rot ?? 0).toBeGreaterThan(poses[i - 1].rot ?? 0);
      assertSmooth({ style, poses, durations: [2] }, 3);
    }
  });

  it('mount-hop, legs-dangle and die-drown pass the travel gate', () => {
    for (const style of STYLES) {
      // Step 0 (crouch → spring) is the fast action: marked smear.
      assertSmooth({ style, poses: P.MOUNT_HOP, durations: MOUNT_HOP_TIMING, smear: [0] }, 3);
      assertSmooth({ style, poses: danglePoses(style), durations: [6], loop: true }, 3);
      // Frames 10-11 draw only bubbles: the gate covers the figure frames.
      assertSmooth({ style, poses: P.DROWN.slice(0, 10), durations: P.DROWN_TIMING }, 3);
    }
  });

  it('no two consecutive frames are identical (1x and 2x)', () => {
    for (const c of HEROES) {
      for (const s of ['flip', 'mount-hop', 'legs-dangle', 'die-drown', 'die-flat']) assertNoDuplicateFrames(`char/${c}/${s}`);
    }
    assertNoDuplicateFrames('fx/chute');
    assertNoDuplicateFrames('fx/chute-collapse');
  });
});
