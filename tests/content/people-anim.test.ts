/**
 * Anim wave, group npc — PEOPLE (plan Phase 3): the handhaver, the ams townspeople and the
 * tourist hostage. Strips pass the motion gate (travel per displayed tick, no identical
 * consecutive frames at 1x and 2x), durations keep the tell / state timings, and the turns and
 * mode transitions are draw-only (gameplay state changes at once).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { frameCount, spriteAnim } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import '../../src/game/content/props/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { AmsStaff, type AmsBaker } from '../../src/game/content/missions/ams/entities';
import { BOW5, FREED7, HOSTAGE_STYLES, TOURIST_BOW_TIMING, TOURIST_FREED_TIMING } from '../../src/game/content/items/hostage.art';
import { TurningHostage } from '../../src/game/content/items/hostages';
import type { Handhaver } from '../../src/game/content/locals/index';
import { HANDHAVER } from '../../src/game/content/locals/handhaver';
import * as P from '../../src/game/art/poses';
import { assertNoDuplicateFrames, assertSmooth } from '../art/motion';
import { TestWorld } from './helpers';

beforeAll(async () => {
  await import('../../src/game/content/missions/ams/index');
});

describe('people strips: motion gate', () => {
  it('handhaver (baked 40 px, tools/art40): idle 4, walk 12 (48 ticks), turn 2, throw 6 (20 ticks inside throw + recover)', () => {
    for (const set of ['handhaver', 'handhaver-b', 'handhaver-c']) {
      expect(frameCount(`enemy/${set}/idle`)).toBe(4);
      expect(frameCount(`enemy/${set}/walk`)).toBe(12);
      expect(frameCount(`enemy/${set}/turn`)).toBe(2);
      expect(frameCount(`enemy/${set}/throw`)).toBe(6);
      for (const a of ['idle', 'walk', 'turn', 'throw']) assertNoDuplicateFrames(`enemy/${set}/${a}`);
    }
    const sum = (d: readonly number[] | undefined): number => (d ?? []).reduce((a, b) => a + b, 0);
    expect(sum(spriteAnim('enemy/handhaver/walk').durations)).toBe(48);
    expect(sum(spriteAnim('enemy/handhaver/throw').durations)).toBe(20);
    expect(sum(spriteAnim('enemy/handhaver/throw').durations)).toBeLessThanOrEqual(HANDHAVER.throwTicks + HANDHAVER.recover);
    // the tell: the wind-up (last frame) is held until the ticket leaves
    const tell = spriteAnim('enemy/handhaver/tell').durations ?? [];
    expect(tell[tell.length - 1]).toBe(9999);
    expect(sum(tell.slice(0, -1))).toBeLessThanOrEqual(HANDHAVER.tele);
  });

  it('townspeople: baked 40 px sets at the plan class counts, transitions and turns 2 frames', () => {
    // the crew (npc/ams/ams-staff/0..2): tests/art40/ams-staff.test.ts; the hot-dog vendor: tests/art40/ams-hotdog-vendor.test.ts;
    // the baker (npc/ams/ams-baker): tests/art40/ams-baker.test.ts (every strip, timing, point and the toss release)
    const s = 'npc/ams/ams-baker';
    expect(frameCount(`${s}/idle`)).toBe(4);
    expect(frameCount(`${s}/turn`)).toBe(2);
    expect(frameCount(`${s}/wave`)).toBe(6);
    expect(frameCount(`${s}/clap`)).toBe(6);
    for (const a of ['idle', 'turn', 'wave', 'in-wave', 'clap', 'in-clap', 'in-cheer', 'cheer', 'talk', 'walk', 'toss']) assertNoDuplicateFrames(`${s}/${a}`);
  });

  it('tourist: bow 5 in 12 ticks, freed 7 in 20 ticks, turn 2, sack-turn 2', () => {
    const T = 'item/hostage/tourist/';
    expect(frameCount(T + 'bow')).toBe(5);
    expect(frameCount(T + 'freed')).toBe(7);
    expect(TOURIST_BOW_TIMING.reduce((a, b) => a + b, 0)).toBe(12);
    expect(TOURIST_FREED_TIMING.reduce((a, b) => a + b, 0)).toBe(20);
    for (const a of ['bow', 'freed', 'turn', 'sack-turn']) assertNoDuplicateFrames(T + a);
    const style = HOSTAGE_STYLES.tourist;
    assertSmooth({ style, poses: BOW5('tourist'), durations: TOURIST_BOW_TIMING });
    // The hop (crouch → airborne) is the one smear step.
    assertSmooth({ style, poses: FREED7('tourist'), durations: TOURIST_FREED_TIMING, smear: [0] });
    expect(frameCount('item/hostage/critic/bow')).toBe(2);
    void P;
  });
});

describe('people: draw-only turns and transitions', () => {
  it('the handhaver turns with hysteresis: a short pass behind him does not flip him', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const h = tw.spawn('handhaver', 300, { hold: 400, facing: -1 }) as Handhaver;
    tw.run(2);
    expect(h.facing).toBe(-1);
    const p = tw.player!;
    p.x = 320; // behind him, briefly
    tw.run(4);
    expect(h.facing).toBe(-1);
    tw.run(30);
    expect(h.facing).toBe(1);
    expect(tw.world.errors).toEqual([]);
  });

  it('townspeople: facing and mode change at once; the turn and the transition are drawn over a few ticks', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    const s = tw.spawn('ams-staff', 200, { look: 1 }) as AmsStaff;
    tw.run(2);
    s.face(400);
    expect(s.facing).toBe(1);
    tw.run(1);
    expect(s.turnT).toBeGreaterThan(0);
    tw.run(10);
    expect(s.turnT).toBe(0);
    s.wave();
    expect(s.mode).toBe('wave');
    expect(s.trT).toBeGreaterThan(0);
    tw.run(10);
    expect(s.trT).toBe(0);
    s.idle();
    expect(s.trT).toBeGreaterThan(0);
    const b = tw.spawn('ams-baker', 150) as AmsBaker;
    b.toss({ id: 'pickup-bombs' });
    expect(b.trT).toBe(0);
    expect(tw.world.errors).toEqual([]);
  });

  it('a tourist hostage is a TurningHostage and finishes its flow', () => {
    const tw = new TestWorld({ playerX: 260, god: true });
    const h = tw.spawn('hostage', 200, { kind: 'tourist' }) as TurningHostage;
    expect(h).toBeInstanceOf(TurningHostage);
    tw.player!.x = 200;
    tw.until(() => h.state === 'run' || h.removed, 900);
    expect(['run', 'bow']).toContain(h.state);
    expect(tw.world.errors).toEqual([]);
  });
});
