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
import { CLAP4, IDLE, STAFF_STYLES, BAKER_STYLE, WAVE4 } from '../../src/game/content/missions/ams/npc.art';
import { HANDHAVER_STYLE, HANDHAVER_THROW_TIMING, THROW_ALL, WALK_SWING } from '../../src/game/content/locals/handhaver.art';
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
  it('handhaver: idle 4, walk 8 with arm swing, turn 2, throw 5 (flick timing kept)', () => {
    for (const set of ['handhaver', 'handhaver-b', 'handhaver-c']) {
      expect(frameCount(`enemy/${set}/idle`)).toBe(4);
      expect(frameCount(`enemy/${set}/walk`)).toBe(8);
      expect(frameCount(`enemy/${set}/turn`)).toBe(2);
      expect(frameCount(`enemy/${set}/throw`)).toBe(5);
      for (const a of ['idle', 'walk', 'turn', 'throw']) assertNoDuplicateFrames(`enemy/${set}/${a}`);
    }
    expect(HANDHAVER_THROW_TIMING.slice(0, 2)).toEqual([3, 5]);
    expect(HANDHAVER_THROW_TIMING.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(HANDHAVER.throwTicks + HANDHAVER.recover);
    expect(spriteAnim('enemy/handhaver/tell').durations).toEqual([8, 8, 9999]);
    assertSmooth({ style: HANDHAVER_STYLE, poses: WALK_SWING, durations: [6], loop: true });
    assertSmooth({ style: HANDHAVER_STYLE, poses: THROW_ALL(HANDHAVER_STYLE).slice(1), durations: HANDHAVER_THROW_TIMING.slice(1) });
  });

  it('townspeople: idle 4, clap 4, wave 4, in-<mode> 2, turn 2', () => {
    const sets = ['npc/ams/ams-baker', 'npc/ams/ams-hotdog-vendor', 'npc/ams/ams-staff/0', 'npc/ams/ams-staff/1', 'npc/ams/ams-staff/2'];
    for (const s of sets) {
      expect(frameCount(`${s}/idle`), s).toBe(4);
      expect(frameCount(`${s}/turn`), s).toBe(2);
      expect(frameCount(`${s}/wave`), s).toBe(4);
      for (const a of ['idle', 'turn', 'wave', 'in-wave']) assertNoDuplicateFrames(`${s}/${a}`);
    }
    for (const s of ['npc/ams/ams-baker', 'npc/ams/ams-staff/0']) {
      expect(frameCount(`${s}/clap`)).toBe(4);
      for (const a of ['clap', 'in-clap', 'in-cheer']) assertNoDuplicateFrames(`${s}/${a}`);
    }
    for (const style of [BAKER_STYLE, ...STAFF_STYLES]) {
      assertSmooth({ style, poses: CLAP4, durations: [3], loop: true });
      assertSmooth({ style, poses: WAVE4, durations: [5], loop: true });
      assertSmooth({ style, poses: IDLE, durations: [15], loop: true });
    }
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
