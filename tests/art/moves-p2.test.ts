/** Anim wave p2 (plan Phase 2 rows 7-13, 15, 16): the player strips pass the motion gate. */
import { beforeAll, describe, expect, it } from 'vitest';
import { frameCount, getFrames, isDeferredSprite, listSprites, spriteAnim } from '../../src/engine/sprites';
import {
  blastPoses,
  crouchInPoses,
  crouchOutPoses,
  diePoses,
  idlePoses,
  knifeBPoses,
  knifePoses,
  knifeTiming,
  LAND_TIMING,
  runPoses,
  runTorsoPoses,
  spawnPoses,
  victoryPoses,
  type PlayerArtOpts,
} from '../../src/game/art/human-sprites';
import { renderHuman, type HumanStyle, type Pose } from '../../src/game/art/humanoid';
import { tween } from '../../src/game/art/tween';
import * as P from '../../src/game/art/poses';
import { HERO_STYLES, RECRUIT_STYLE } from '../../src/game/content/characters/art';
import { BOB_ART } from '../../src/game/content/characters/bob.art';
import { DIRK_ART } from '../../src/game/content/characters/dirk.art';
import { GRACE_ART } from '../../src/game/content/characters/grace.art';
import { GRAMPS_ART } from '../../src/game/content/characters/gramps.art';
import { MITTENS_ART } from '../../src/game/content/characters/mittens.art';
import { PATRICK_ART } from '../../src/game/content/characters/patrick.art';
import { PIP_ART } from '../../src/game/content/characters/pip.art';
import { THOM_ART } from '../../src/game/content/characters/thom.art';
import { VINCENT_ART } from '../../src/game/content/characters/vincent.art';
import { assertNoDuplicateFrames, assertSmooth, motionReport } from './motion';

const ART: Readonly<Record<string, PlayerArtOpts>> = {
  recruit: {},
  vincent: VINCENT_ART,
  thom: THOM_ART,
  dirk: DIRK_ART,
  bob: BOB_ART,
  patrick: PATRICK_ART,
  grace: GRACE_ART,
  mittens: MITTENS_ART,
  pip: PIP_ART,
  gramps: GRAMPS_ART,
};
const STYLE: Readonly<Record<string, HumanStyle>> = { recruit: RECRUIT_STYLE, ...HERO_STYLES };
const HEROES = Object.keys(ART);
const W = ['pistol', 'heavy'] as const;

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
});

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

describe('p2 strips: counts, timing, defer', () => {
  it('every hero has the planned frames', () => {
    expect(HEROES.length).toBe(10);
    for (const c of HEROES) {
      const pre = `char/${c}/`;
      const legs: Array<[string, number]> = [
        ['legs-run', 12],
        ['legs-idle', 4],
        ['legs-jump', 4],
        ['legs-fall', 2],
        ['legs-land', 3],
        ['legs-crouch-in', 3],
        ['legs-crouch-out', 2],
      ];
      for (const [id, n] of legs) expect(frameCount(pre + id), `${c} ${id}`).toBe(n);
      expect(spriteAnim(pre + 'legs-land').durations).toEqual([2, 3, 4]);
      expect(spriteAnim(pre + 'legs-crouch-in').durations).toEqual([2, 2, 2]);
      expect(spriteAnim(pre + 'legs-crouch-out').durations).toEqual([2, 2]);
      expect(spriteAnim(pre + 'legs-idle').ticksPerFrame).toBe(16);
      expect(spriteAnim(pre + 'legs-fall').loop).not.toBe(false);
      for (const w of W) {
        const t = `${pre}torso-${w}-`;
        expect(frameCount(t + 'run'), c).toBe(frameCount(pre + 'legs-run'));
        expect(frameCount(t + 'idle'), c).toBe(4);
        expect(spriteAnim(t + 'idle').ticksPerFrame).toBe(12);
        expect(frameCount(t + 'crouch'), c).toBe(4);
        expect(frameCount(t + 'crouch-shoot'), c).toBe(2);
        expect(frameCount(t + 'crouch-throw'), c).toBe(6);
        expect(frameCount(t + 'crouch-knife'), c).toBe(6);
        expect(frameCount(t + 'knife'), c).toBe(6);
        expect(frameCount(t + 'knife-b'), c).toBe(6);
        expect(frameCount(t + 'throw'), c).toBe(6);
        for (const k of ['knife', 'knife-b', 'crouch-knife']) expect(sum(spriteAnim(t + k).durations ?? []), `${c} ${k}`).toBeLessThanOrEqual(14);
        // Status art: the new torso actions have no Helium twin (the player falls back).
        for (const k of ['run', 'crouch', 'crouch-shoot', 'knife-b']) expect(listSprites(`${pre}helium-torso-${w}-${k}`)).toEqual([]);
      }
      expect(frameCount(pre + 'timeout-yawn')).toBe(8);
      expect(frameCount(pre + 'timeout-sleep')).toBe(4);
      expect(spriteAnim(pre + 'timeout-sleep').loop).not.toBe(false);
      for (const id of ['timeout-yawn', 'timeout-sleep', 'fidget-a', 'fidget-b']) expect(isDeferredSprite(pre + id), id).toBe(true);
      // Row 14: every hero has both fidgets (own table or the default), 8-14 frames, timed per frame.
      for (const id of ['fidget-a', 'fidget-b']) {
        const n = frameCount(pre + id);
        expect(n, `${c} ${id}`).toBeGreaterThanOrEqual(8);
        expect(n, `${c} ${id}`).toBeLessThanOrEqual(14);
        expect(spriteAnim(pre + id).durations?.length, `${c} ${id} durations`).toBe(n);
        expect(spriteAnim(pre + id).loop, `${c} ${id}`).toBe(false);
      }
      for (const id of ['legs-run', 'torso-pistol-run', 'torso-pistol-crouch', 'torso-heavy-knife-b', 'die', 'spawn']) expect(isDeferredSprite(pre + id), id).toBe(false);
    }
    expect(frameCount('fx/snore')).toBe(6);
    expect(isDeferredSprite('fx/snore')).toBe(true);
    expect(getFrames('fx/snore', 2).length).toBe(6);
  });

  it('defaults: die 12 (lies on the floor), die-blast 10, victory 8, spawn 6; hero tables stay', () => {
    expect(frameCount('char/recruit/die')).toBe(12);
    expect(frameCount('char/recruit/die-blast')).toBe(10);
    expect(frameCount('char/recruit/victory')).toBe(8);
    expect(frameCount('char/recruit/spawn')).toBe(6);
    for (const c of HEROES) {
      const o = ART[c];
      expect(frameCount(`char/${c}/die`), c).toBe(o.die ? o.die.length : 12);
      expect(frameCount(`char/${c}/victory`), c).toBe(o.victory ? o.victory.length : 8);
      expect(frameCount(`char/${c}/helium-victory`), c).toBe(frameCount(`char/${c}/victory`));
      expect(frameCount(`char/${c}/die-blast`), c).toBe(10);
      expect(frameCount(`char/${c}/spawn`), c).toBe(6);
    }
  });
});

describe('p2 strips: motion gate (every hero style)', () => {
  it('legs: run, idle, jump, fall, land, crouch-in / out', () => {
    for (const c of HEROES) {
      const style = STYLE[c];
      const run = runPoses(style, ART[c].run ?? P.RUN);
      expect(run.length).toBe(12);
      assertSmooth({ style, poses: run, durations: [3], loop: true });
      assertSmooth({ style, poses: P.IDLE_SHIFT, durations: [16], loop: true });
      assertSmooth({ style, poses: P.JUMP4, durations: [3] });
      assertSmooth({ style, poses: P.FALL2, durations: [8], loop: true });
      assertSmooth({ style, poses: [...P.LAND3, P.STAND], durations: LAND_TIMING });
      assertSmooth({ style, poses: [P.STAND, ...crouchInPoses(style), P.CROUCH], durations: [2] });
      assertSmooth({ style, poses: [P.CROUCH, ...crouchOutPoses(style), P.STAND], durations: [2] });
    }
  });

  it('torso: idle, run, crouch, knife (a + b), throw', () => {
    for (const c of HEROES) {
      const style = STYLE[c];
      const o = ART[c];
      for (const w of W) {
        const base: Pose = { ...o.torso, weapon: w };
        const carry: Pose = { ...o.torso, weapon: w, gunHand: 'far' };
        assertSmooth({ style, poses: P.seq(base, idlePoses(o.idle)), durations: [12], loop: true });
        assertSmooth({ style, poses: P.seq(base, runTorsoPoses(12)), durations: [3], loop: true });
        assertSmooth({ style, poses: P.seq(base, P.CROUCH_TORSO), durations: [12], loop: true });
        const knife = knifePoses(o.knife ?? P.KNIFE);
        assertSmooth({ style, poses: P.seq(carry, knife), durations: knifeTiming(knife.length), smear: [1, 2] }, 3);
        assertSmooth({ style, poses: P.seq(carry, knifeBPoses(o.knife ?? P.KNIFE)), durations: P.KNIFE6_TIMING, smear: [1, 2] }, 3);
        assertSmooth({ style, poses: P.seq(carry, P.THROW6), durations: P.THROW6_TIMING, smear: [1, 2] }, 3);
      }
    }
  });

  it('full body: die, die-blast, victory, spawn, time-out', () => {
    for (const c of HEROES) {
      const style = STYLE[c];
      assertSmooth({ style, poses: diePoses(style), durations: P.DIE12_TIMING });
      assertSmooth({ style, poses: blastPoses(style), durations: P.DIE_BLAST10_TIMING, smear: [0] });
      assertSmooth({ style, poses: victoryPoses(style), durations: [4], loop: true });
      assertSmooth({ style, poses: spawnPoses(style), durations: P.SPAWN6_TIMING });
      assertSmooth({ style, poses: P.TIMEOUT_YAWN, durations: P.TIMEOUT_YAWN_TIMING });
      assertSmooth({ style, poses: P.TIMEOUT_SLEEP, durations: [12], loop: true });
      // The default fidgets (heroes without their own table).
      assertSmooth({ style, poses: tween(style, P.FIDGET_A_KEYS, { perKey: P.FIDGET_A_PER, ease: 'inOut' }), durations: P.FIDGET_A_TIMING });
      assertSmooth({ style, poses: tween(style, P.FIDGET_B_KEYS, { perKey: P.FIDGET_B_PER, ease: 'inOut' }), durations: P.FIDGET_B_TIMING });
    }
  });

  it('no two consecutive frames identical (1x and 2x)', () => {
    for (const c of HEROES) {
      const pre = `char/${c}/`;
      const ids = ['legs-run', 'legs-idle', 'legs-jump', 'legs-fall', 'legs-land', 'legs-crouch-in', 'legs-crouch-out', 'die-blast', 'spawn', 'timeout-yawn', 'timeout-sleep', 'fidget-a', 'fidget-b'];
      if (!ART[c].die) ids.push('die');
      if (!ART[c].victory) ids.push('victory', 'helium-victory');
      for (const w of W) for (const k of ['run', 'idle', 'crouch', 'crouch-shoot', 'crouch-throw', 'crouch-knife', 'knife', 'knife-b', 'throw']) ids.push(`torso-${w}-${k}`);
      for (const id of ids) assertNoDuplicateFrames(pre + id);
    }
    assertNoDuplicateFrames('fx/snore');
  });

  it('the motion report sees the run as a loop of 12 steps', () => {
    const r = motionReport({ style: RECRUIT_STYLE, poses: runPoses(RECRUIT_STYLE, P.RUN), durations: [3], loop: true });
    expect(r.steps.length).toBe(12);
  });
});

describe('p2 strips: gameplay points', () => {
  it('idle and crouch hips are constant across frames (1x and 2x)', () => {
    for (const c of HEROES) {
      for (const id of ['legs-idle', 'legs-crouch']) {
        for (const d of [1, 2]) {
          const hips = new Set(getFrames(`char/${c}/${id}`, d).map((f) => String(f.pts?.hip)));
          expect(hips.size, `${c} ${id} @${d}x`).toBe(1);
        }
      }
    }
  });

  it('crouch-shoot[0] muzzle equals shoot[0] muzzle (both weapons, 1x and 2x)', () => {
    for (const c of HEROES) {
      for (const w of W) {
        for (const d of [1, 2]) {
          const a = getFrames(`char/${c}/torso-${w}-crouch-shoot`, d)[0];
          const b = getFrames(`char/${c}/torso-${w}-shoot`, d)[0];
          expect(a.pts?.muzzle, `${c} ${w} @${d}x`).toEqual(b.pts?.muzzle);
          expect([a.ox, a.oy]).toEqual([b.ox, b.oy]);
        }
      }
    }
  });

  it('throw: the release frame (strict max of hand x - y) stays index 2 with the same hand point', () => {
    for (const c of HEROES) {
      const o = ART[c];
      for (const w of W) {
        const was = renderHuman(STYLE[c], { ...o.torso, weapon: w, gunHand: 'far', ...P.THROW[2] }, 'upper').pts.hand;
        for (const d of [1, 2]) {
          const fs = getFrames(`char/${c}/torso-${w}-throw`, d);
          const score = fs.map((f) => (f.pts?.hand ? f.pts.hand[0] - f.pts.hand[1] : -Infinity));
          for (let i = 0; i < fs.length; i++) if (i !== 2) expect(score[i], `${c} ${w} @${d}x frame ${i}`).toBeLessThan(score[2]);
          expect(fs[2].pts?.hand, `${c} ${w} @${d}x`).toEqual(was);
        }
      }
    }
  });
});
