import { describe, expect, it } from 'vitest';
import '../../src/game/content/locals/rider.art';
import '../../src/game/content/locals/fatbike-youth.art';
import { frameCount, getFrames, isDeferredSprite, spriteAnim } from '../../src/engine/sprites';
import { RIDER_TURN } from '../../src/game/content/locals/rider';
import { FATBIKE } from '../../src/game/content/locals/fatbike-youth';
import { DELIVERY } from '../../src/game/content/locals/delivery-rider';
import { KICK_HIT } from '../../src/game/content/art40/fatbike-youth-pair-1a.gen';
import { assertNoDuplicateFrames } from '../art/motion';

// The fatbike youths are baked 40 px sets with the plan's frame counts: look 0 in
// tests/art40/fatbike-youth.test.ts, the looks 1-3 and the pairs in tests/art40/fatbike-youth-looks.test.ts.
// The delivery rider is a baked 40 px set too: tests/art40/delivery-rider.test.ts.
const SETS = ['enemy/fatbike-youth-pair-1b'];

describe('rider animation (anim wave, RIDERS)', () => {
  it('frame counts per set', () => {
    for (const s of SETS) {
      expect(frameCount(`${s}/ride`)).toBe(12);
      expect(frameCount(`${s}/idle`)).toBe(4);
      expect(frameCount(`${s}/kick`)).toBe(6);
      expect(frameCount(`${s}/turn`)).toBe(RIDER_TURN.frames);
    }
    expect(frameCount('enemy/fatbike-youth-pair-1b/tell')).toBe(6);
    expect(frameCount('enemy/fatbike-youth-pair-1b/die-seat')).toBe(12);
    expect(frameCount('enemy/fatbike-youth-pair-1b/get-up')).toBe(6);
    expect(frameCount('enemy/fatbike-youth/ride')).toBe(12);
    expect(frameCount('enemy/fatbike-youth/kick')).toBe(6);
    expect(frameCount('enemy/fatbike-youth/turn')).toBe(RIDER_TURN.frames);
  });

  it('die-seat and get-up are deferred; normal strips are not', () => {
    expect(isDeferredSprite('enemy/fatbike-youth/die-seat')).toBe(true);
    expect(isDeferredSprite('enemy/fatbike-youth/get-up')).toBe(true);
    expect(isDeferredSprite('enemy/fatbike-youth/ride')).toBe(false);
  });

  it('kick extension shows inside the kick window; tell timings unchanged', () => {
    const d = spriteAnim('enemy/fatbike-youth-pair-1b/kick').durations ?? [];
    const ext = d.slice(0, KICK_HIT).reduce((a, b) => a + b, 0);
    expect(ext).toBeLessThan(DELIVERY.kick);
    expect(FATBIKE.tele).toBe(24);
    expect(DELIVERY.tele).toBe(20);
    expect(spriteAnim('enemy/fatbike-youth/kick').loop).toBe(false);
  });

  it('turn frames narrow and keep the ground line', () => {
    const idle = getFrames('enemy/fatbike-youth/idle', 1)[0];
    const t = getFrames('enemy/fatbike-youth/turn', 1);
    for (let i = 1; i < t.length; i++) expect(t[i].buf.w).toBeLessThan(t[i - 1].buf.w);
    for (const f of t) expect(f.oy).toBe(idle.oy);
  });

  it('no two consecutive frames identical', () => {
    for (const n of ['ride', 'idle', 'kick', 'tell', 'turn', 'die-seat', 'get-up']) assertNoDuplicateFrames(`enemy/fatbike-youth/${n}`);
  });
});
