/**
 * Anim wave p2 FIDGETS (plan Phase 2 row 14): the squad's own fidget-a / fidget-b and the
 * lengthened bored strips. Each passes the motion gate (travel per displayed tick, no identical
 * consecutive frames at 1x and 2x) and its durations match its frames.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { frameCount, getFrames, hasSprite, spriteAnim, type Frame } from '../../src/engine/sprites';
import { poseFrames, type DecoratedAnim, type PlayerArtOpts } from '../../src/game/art/human-sprites';
import type { HumanStyle, Pose } from '../../src/game/art/humanoid';
import { BOB_ART, BOB_STYLE } from '../../src/game/content/characters/bob.art';
import { DIRK_ART, DIRK_STYLE } from '../../src/game/content/characters/dirk.art';
import { PATRICK_ART, PATRICK_STYLE } from '../../src/game/content/characters/patrick.art';
import { THOM_ART, THOM_STYLE } from '../../src/game/content/characters/thom.art';
import { VINCENT_ART, VINCENT_STYLE } from '../../src/game/content/characters/vincent.art';
import { assertSmooth } from '../art/motion';

const SQUAD: ReadonlyArray<[string, HumanStyle, PlayerArtOpts]> = [
  ['vincent', VINCENT_STYLE, VINCENT_ART],
  ['thom', THOM_STYLE, THOM_ART],
  ['dirk', DIRK_STYLE, DIRK_ART],
  ['bob', BOB_STYLE, BOB_ART],
  ['patrick', PATRICK_STYLE, PATRICK_ART],
];

const STRIPS: ReadonlyArray<[DecoratedAnim, (o: PlayerArtOpts) => readonly Pose[] | undefined, number, number]> = [
  ['fidget-a', (o) => o.fidgetA, 8, 14],
  ['fidget-b', (o) => o.fidgetB, 8, 14],
  ['bored', (o) => o.bored, 10, 16],
];

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
});

function same(a: Frame, b: Frame): boolean {
  if (a.ox !== b.ox || a.oy !== b.oy || a.buf.w !== b.buf.w || a.buf.h !== b.buf.h) return false;
  const x = a.buf.data;
  const y = b.buf.data;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** Rendered frames as the game makes them: the registered sprite when present, else the rig + decorate. */
function frames(id: string, style: HumanStyle, o: PlayerArtOpts, name: DecoratedAnim, poses: readonly Pose[], d: 1 | 2): readonly Frame[] {
  if (hasSprite(id)) return getFrames(id, d);
  const f = poseFrames(style, poses, 'full', d);
  const add = o.decorate?.[name];
  return add ? add(f, poses) : f;
}

describe('squad fidgets and bored strips', () => {
  for (const [hero, style, o] of SQUAD) {
    for (const [name, get, min, max] of STRIPS) {
      it(`${hero} ${name}: frame count, durations, motion gate, no duplicates`, () => {
        const poses = get(o);
        expect(poses, `${hero} has its own ${name}`).toBeDefined();
        const p = poses ?? [];
        expect(p.length).toBeGreaterThanOrEqual(min);
        expect(p.length).toBeLessThanOrEqual(max);
        const dur = o.durations?.[name];
        expect(dur?.length, `${hero} ${name} durations`).toBe(p.length);
        assertSmooth({ style, poses: p, durations: dur ?? [8] }, 3);
        const id = `char/${hero}/${name}`;
        if (hasSprite(id)) {
          expect(frameCount(id)).toBe(p.length);
          expect(spriteAnim(id).durations).toEqual(dur);
        }
        for (const d of [1, 2] as const) {
          const fs = frames(id, style, o, name, p, d);
          const dup: number[] = [];
          for (let i = 0; i + 1 < fs.length; i++) if (same(fs[i], fs[i + 1])) dup.push(i);
          expect(dup, `${id} @${d}x identical consecutive frames`).toEqual([]);
        }
      });
    }
  }
});
