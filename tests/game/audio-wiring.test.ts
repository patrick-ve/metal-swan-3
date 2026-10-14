/**
 * The runner's audio wiring (2026-10-14): the section ambience loop (`SectionDef.ambience`, key
 * 'ambience'), 'stopLoops' at a section exit and the mission end, the GO arrow's cue and the
 * footsteps of missions with `footsteps`. Missions without ambience never touch the key.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { VirtualPad, buttonMask } from '../../src/engine/input';
import { terrain } from '../../src/engine/terrain';
import { MissionRunner, type MissionDef, type SectionDef } from '../../src/game/mission/index';
import { GameSession } from '../../src/game/session';
import { FLOOR } from './helpers';

function flat(id: string, script: SectionDef['script'], extra: Partial<SectionDef> = {}): SectionDef {
  const t = terrain(1200, 216);
  t.ground().at(0, FLOOR).flat(1200);
  return {
    id,
    width: 1200,
    height: 216,
    scroll: 'right',
    background: { sky: 0x203040ff, layers: [] },
    terrain: t.build(),
    terrainStyle: { ground: 'dirt', edge: 'grass' },
    playerStart: { x: 40, y: FLOOR },
    script,
    ...extra,
  };
}

function* idle(): Generator<number, void, unknown> {
  for (;;) yield 1000;
}

function mission(o: Partial<MissionDef> = {}, ambience: (string | undefined)[] = []): MissionDef {
  return {
    id: 'audio-test',
    name: 'AUDIO TEST',
    music: 'test-song',
    start: 'a',
    sections: {
      a: flat('a', function* a(ctx) {
        yield 5;
        yield ctx.exitTo('b');
      }, { ambience: ambience[0] }),
      b: flat('b', idle, { ambience: ambience[1] }),
      c: flat('c', idle, { ambience: ambience[2] }),
    },
    ...o,
  };
}

function setup(m: MissionDef): { runner: MissionRunner; audio: NullAudio; pads: [VirtualPad, VirtualPad] } {
  const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  const audio = new NullAudio();
  const runner = new MissionRunner({ session: new GameSession(), mission: m, pads, audio, seed: 3 });
  return { runner, audio, pads };
}

const count = (log: readonly string[], entry: string): number => log.filter((e) => e === entry).length;

describe('runner audio: ambience and stopLoops', () => {
  it('plays a section ambience once, keeps the same id across sections, swaps a new one and stops at the mission end', () => {
    const { runner, audio } = setup(mission({}, ['env/ams-canal', 'env/ams-canal', 'env/ams-street']));
    runner.start();
    let stops = 0;
    runner.world.events.on('stopLoops', () => stops++);
    for (let i = 0; i < 120 && runner.section.id === 'a'; i++) runner.update();
    expect(runner.section.id).toBe('b');
    expect(stops).toBe(1);
    expect(count(audio.log, 'loop:ambience:env/ams-canal')).toBe(1);
    runner.loadSection('c');
    expect(count(audio.log, 'loop:ambience:env/ams-street')).toBe(1);
    runner.completeMission();
    expect(count(audio.log, 'stopLoop:ambience')).toBe(1);
    runner.stopLoops();
    expect(count(audio.log, 'stopLoop:ambience')).toBe(1);
  });

  it('a mission without ambience never touches the key', () => {
    const { runner, audio } = setup(mission());
    runner.start();
    for (let i = 0; i < 60; i++) runner.update();
    runner.completeMission();
    expect(audio.log.filter((e) => e.includes('ambience'))).toEqual([]);
  });
});

describe('runner audio: the GO arrow and footsteps', () => {
  it('the GO arrow plays ui/go once when it comes up (not on every blink)', () => {
    const { runner, audio } = setup(mission({ sections: { a: flat('a', idle) } }));
    runner.start();
    runner.hud.showGo('right', 0);
    for (let i = 0; i < 60; i++) runner.update();
    expect(count(audio.log, 'sfx:ui/go')).toBe(1);
    runner.hud.hideGo();
    runner.update();
    runner.hud.showGo('right', 0);
    runner.update();
    expect(count(audio.log, 'sfx:ui/go')).toBe(2);
  });

  it.each([
    [true, 4],
    [false, 0],
  ])('footsteps %s: %i steps in 64 ticks of running (every 16 ticks)', (footsteps, steps) => {
    const { runner, audio, pads } = setup(mission({ footsteps, sections: { a: flat('a', idle) } }));
    runner.start();
    for (let i = 0; i < 30; i++) runner.update();
    const before = count(audio.log, 'sfx:player/step');
    expect(before).toBe(0);
    for (let i = 0; i < 64; i++) {
      pads[0].update(buttonMask('right'));
      runner.update();
    }
    const n = count(audio.log, 'sfx:player/step');
    if (steps === 0) expect(n).toBe(0);
    else {
      expect(n).toBeGreaterThanOrEqual(steps - 1);
      expect(n).toBeLessThanOrEqual(steps);
    }
  });
});
