/**
 * ROBO-HALSEMA motion (animation wave, plan Phase 3 BOSS): the stamp arm has 6 poses per facing
 * (low, raised, impact, anticipation, smear, recoil), the chain whirl is a 6-frame loop per lane,
 * the walk is 6 frames, the stomp has a half squat and a push-off, and the flying wig turns in 8
 * steps. Frames next to each other in a loop are never identical, at 1×, 2× and 4× (UHD art).
 */
import { describe, expect, it } from 'vitest';
import { frameCount, getFrames, setHiArt } from '../../src/engine/sprites';
import { ARM_FRAMES, MAYOR_WALK, WIG_STEPS } from '../../src/game/content/bosses/ams/art';
import '../../src/game/content/bosses/ams/index';

const ART = 'boss/ams-mayor';

function same(id: string, a: number, b: number, d: number): boolean {
  const fs = getFrames(id, d);
  const x = fs[a];
  const y = fs[b];
  if (x.buf.w !== y.buf.w || x.buf.h !== y.buf.h || x.ox !== y.ox || x.oy !== y.oy) return false;
  for (let i = 0; i < x.buf.data.length; i++) if (x.buf.data[i] !== y.buf.data[i]) return false;
  return true;
}

function loopDiffers(id: string, seq: readonly number[], d: number): void {
  for (let i = 0; i < seq.length; i++) {
    const a = seq[i];
    const b = seq[(i + 1) % seq.length];
    expect(same(id, a, b, d), `${id}@${d}x ${a}→${b}`).toBe(false);
  }
}

describe('ROBO-HALSEMA motion strips', () => {
  it('has the frame counts of the plan', () => {
    expect(ARM_FRAMES).toBe(6);
    for (const s of [0, 1, 2]) expect(frameCount(`${ART}/stamp-arm-${s}`)).toBe(12);
    expect(frameCount(`${ART}/arm-back`)).toBe(13);
    expect(frameCount(`${ART}/legs`)).toBe(11);
    expect(MAYOR_WALK.length).toBe(6);
    expect(frameCount(`${ART}/wig`)).toBe(WIG_STEPS);
    expect(WIG_STEPS).toBe(8);
  });

  for (const d of [1, 2, 4]) {
    it(`no two consecutive frames are identical (${d}×)`, () => {
      if (d > 1) setHiArt(true);
      // Slam: raise (0 → anticipation → smear → raised), drop (smear → impact → recoil → impact → low).
      loopDiffers(`${ART}/stamp-arm-0`, [0, 3, 4, 1, 4, 2, 5], d);
      loopDiffers(`${ART}/stamp-arm-0`, [6, 9, 10, 7, 10, 8, 11], d);
      // Chain whirl: high 1, 3–7; low 2, 8–12.
      loopDiffers(`${ART}/arm-back`, [1, 3, 4, 5, 6, 7], d);
      loopDiffers(`${ART}/arm-back`, [2, 8, 9, 10, 11, 12], d);
      loopDiffers(`${ART}/legs`, MAYOR_WALK, d);
      loopDiffers(`${ART}/legs`, [0, 9, 3, 9, 10], d);
      loopDiffers(`${ART}/wig`, [0, 1, 2, 3, 4, 5, 6, 7], d);
    });
  }
});
