/**
 * The people of ams at 40 px (docs/design/ams40.md wave 5: the baker, the hot-dog vendor, the crew
 * 0–2, the window waver and the cat): the logic time of every strip stays the one the OLD strips had
 * (rule 4), pinned here as literals. docs/design/ams40/contract.json is regenerated from the live
 * code after every wave, so tests that compare a strip with the contract compare the new art with
 * itself; this file keeps the pre-wave numbers (the wave-6 verifier's snapshot of the old strips).
 *
 * The four totals that changed on purpose are listed in CHANGED with the reason:
 * - the baker's and the crew's walk: locomotion is drawn for the speed (0.8 px/tick, strideRate);
 *   only the speed is contract. 12 × 3 ticks = 28.8 px a cycle (the approved handhaver's stride).
 * - the vendor's salute: the code plays it for the salute mode's own 70 ticks; the old 40-tick strip
 *   looped inside the mode and cut mid-chuckle. One 70-tick pass ends on the lowered hand.
 * - the waver's person strip: the entity picks its frames by role (waverPick, WAVER_* constants)
 *   inside the unchanged phase windows 100 / 130 / 250 / 280; the strip total is not read.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { frameCount, getFrames, spriteAnim } from '../../src/engine/sprites';
import { TOSS_RELEASE } from '../../src/game/content/art40/ams-baker.gen';
import { PERSON_TR_TICKS, PERSON_TURN_TICKS, PERSON_WALK_SPEED } from '../../src/game/content/missions/ams/npc.art';
import { CAT_SWISH_TICKS, WAVER_LEAN_TICKS, WAVER_PHASE } from '../../src/game/content/missions/ams/ambient';

beforeAll(async () => {
  await import('../../src/game/content/missions/ams/index');
});

/** [old frames, old total ticks, loop] of every people id before wave 5 (contract-before.json). */
const OLD: Readonly<Record<string, readonly [frames: number, ticks: number, loop: boolean]>> = {
  'npc/ams/ams-baker/cheer': [4, 32, true],
  'npc/ams/ams-baker/clap': [4, 12, true],
  'npc/ams/ams-baker/idle': [4, 60, true],
  'npc/ams/ams-baker/in-cheer': [2, 6, false],
  'npc/ams/ams-baker/in-clap': [2, 6, false],
  'npc/ams/ams-baker/in-talk': [2, 6, false],
  'npc/ams/ams-baker/in-wave': [2, 6, false],
  'npc/ams/ams-baker/talk': [4, 32, true],
  'npc/ams/ams-baker/toss': [4, 28, false],
  'npc/ams/ams-baker/turn': [2, 4, true],
  'npc/ams/ams-baker/walk': [8, 48, true],
  'npc/ams/ams-baker/wave': [4, 20, true],
  'npc/ams/ams-hotdog-vendor/idle': [4, 60, true],
  'npc/ams/ams-hotdog-vendor/in-talk': [2, 6, false],
  'npc/ams/ams-hotdog-vendor/in-wave': [2, 6, false],
  'npc/ams/ams-hotdog-vendor/salute': [2, 40, true],
  'npc/ams/ams-hotdog-vendor/talk': [4, 32, true],
  'npc/ams/ams-hotdog-vendor/turn': [2, 4, true],
  'npc/ams/ams-hotdog-vendor/wave': [4, 20, true],
  ...Object.fromEntries(
    [0, 1, 2].flatMap((l) => [
      [`npc/ams/ams-staff/${l}/cheer`, [4, 32, true]],
      [`npc/ams/ams-staff/${l}/clap`, [4, l === 1 ? 16 : 12, true]],
      [`npc/ams/ams-staff/${l}/idle`, [4, [60, 68, 76][l], true]],
      [`npc/ams/ams-staff/${l}/in-cheer`, [2, 6, false]],
      [`npc/ams/ams-staff/${l}/in-clap`, [2, 6, false]],
      [`npc/ams/ams-staff/${l}/in-wave`, [2, 6, false]],
      [`npc/ams/ams-staff/${l}/turn`, [2, 4, true]],
      [`npc/ams/ams-staff/${l}/walk`, [8, 48, true]],
      [`npc/ams/ams-staff/${l}/wave`, [4, 20, true]],
    ]),
  ),
  'npc/ams/ams-window-waver/cat': [2, 48, true],
  'npc/ams/ams-window-waver/cat-swish': [4, 48, true],
  'npc/ams/ams-window-waver/lean': [3, 9, false],
  'npc/ams/ams-window-waver/person': [4, 40, true],
};

/** The totals changed on purpose: id -> the new total (the file header gives the reasons). */
const CHANGED: Readonly<Record<string, number>> = {
  'npc/ams/ams-baker/walk': 36,
  'npc/ams/ams-staff/0/walk': 36,
  'npc/ams/ams-staff/1/walk': 36,
  'npc/ams/ams-staff/2/walk': 36,
  'npc/ams/ams-hotdog-vendor/salute': 70,
  'npc/ams/ams-window-waver/person': 54,
};

const total = (id: string): number => {
  const a = spriteAnim(id);
  return a.durations ? a.durations.reduce((x, y) => x + y, 0) : a.ticksPerFrame * frameCount(id);
};

describe('ams people: the old logic time stays (rule 4)', () => {
  it('every old id is still registered (rule 1), with at least as many frames as before', () => {
    for (const [id, [frames]] of Object.entries(OLD)) {
      const n = getFrames(id, 1).length;
      expect(n, id).toBeGreaterThanOrEqual(frames);
    }
  });

  it('every total and loop flag equals the old one, except the listed changes', () => {
    const wrong: string[] = [];
    for (const [id, [, ticks, loop]] of Object.entries(OLD)) {
      const want = CHANGED[id] ?? ticks;
      if (total(id) !== want) wrong.push(`${id}: ${total(id)} ticks, want ${want}`);
      if (spriteAnim(id).loop !== loop) wrong.push(`${id}: loop ${spriteAnim(id).loop}, want ${loop}`);
    }
    expect(wrong).toEqual([]);
  });

  it('the changed totals keep what the code reads: the walk stride speed, the salute mode, the phase windows', () => {
    // a walk cycle: the stride is drawn for PERSON_WALK_SPEED, 28.8 px (12 frames of 3 ticks)
    expect(PERSON_WALK_SPEED).toBe(0.8);
    for (const id of ['npc/ams/ams-baker/walk', 'npc/ams/ams-staff/0/walk', 'npc/ams/ams-staff/1/walk', 'npc/ams/ams-staff/2/walk']) {
      expect(total(id) * PERSON_WALK_SPEED, id).toBeCloseTo(28.8, 6);
    }
    // the salute strip is the 70-tick salute mode (entities.ts setMode('salute', 70)) in one pass
    expect(total('npc/ams/ams-hotdog-vendor/salute')).toBe(70);
    // the waver's phase windows and the lean / swish times of before
    expect(WAVER_PHASE).toEqual({ in: 100, wave: 130, idle: 250, out: 280 });
    expect(WAVER_LEAN_TICKS).toBe(9);
    expect(CAT_SWISH_TICKS).toBe(48);
  });

  it('the event ticks of before: the toss release at tick 14 of 28; transitions 2 × 3, turns 2 × 2', () => {
    const toss = spriteAnim('npc/ams/ams-baker/toss').durations!;
    expect(toss.slice(0, TOSS_RELEASE).reduce((x, y) => x + y, 0)).toBe(14);
    expect(PERSON_TR_TICKS).toBe(3);
    expect(PERSON_TURN_TICKS).toBe(2);
    for (const id of Object.keys(OLD).filter((k) => /\/in-[a-z]+$/.test(k))) expect(spriteAnim(id).durations, id).toEqual([3, 3]);
    for (const id of Object.keys(OLD).filter((k) => k.endsWith('/turn'))) expect(spriteAnim(id).durations, id).toEqual([2, 2]);
  });
});
