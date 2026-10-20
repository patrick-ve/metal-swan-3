/**
 * Review round 1: mission runner flow. Regression tests: each asserts the correct behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { VirtualPad, buttonMask, type Button } from '../../src/engine/input';
import { terrain } from '../../src/engine/terrain';
import { MissionRunner, type MissionDef, type SectionDef } from '../../src/game/mission/index';
import { GameSession } from '../../src/game/session';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR } from '../game/helpers';

function flat(id: string, script: SectionDef['script'], extra: Partial<SectionDef> = {}): SectionDef {
  const t = terrain(800, 216);
  t.ground().at(0, FLOOR).flat(800);
  return {
    id,
    width: 800,
    height: 216,
    scroll: 'right',
    background: { sky: 0x203040ff, layers: [] },
    terrain: t.build(),
    terrainStyle: { ground: 'dirt', edge: 'grass' },
    playerStart: { x: 60, y: FLOOR },
    script,
    ...extra,
  };
}

describe('review r1: mission flow', () => {
  // R1-09: loadSection() only spawns players for `slot.active` slots and resets continueTicks.
  // A slot that is out (game over, 2P) gets no Player in the next section, so
  // continuePlayer() (needs a Player in state 'out') returns false forever, and
  // GameplayScene.handleJoin() only re-joins slots that never joined. Player 2 is locked out for
  // the rest of the game.
  it('R1-09: 2P — a player who is out can continue after the partner changes section', () => {
    const idle: SectionDef['script'] = function* idle() {
      yield () => false;
    };
    const mission: MissionDef = {
      id: 'review-r1-flow',
      name: 'FLOW',
      music: '',
      start: 'a',
      sections: {
        a: flat('a', idle, { exits: [{ id: 'e', rect: { x: 300, y: 0, w: 40, h: 216 }, to: 'b' }] }),
        b: flat('b', idle),
      },
    };
    const session = new GameSession({ characters: ['recruit', 'recruit'] });
    const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
    const runner = new MissionRunner({ session, mission, pads, audio: new NullAudio(), seed: 3 });
    runner.start();
    let mask0 = 0;
    const run = (n: number): void => {
      for (let i = 0; i < n; i++) {
        pads[0].update(mask0);
        pads[1].update(0);
        runner.update();
      }
    };
    session.slots[1].lives = 1;
    runner.player(1)!.kill('bullet');
    run(80);
    expect(runner.player(1)!.state).toBe('out');
    // Player 1 walks into the exit while player 2's continue countdown still runs.
    mask0 = buttonMask('right');
    for (let i = 0; i < 600 && runner.section.id === 'a'; i++) run(1);
    mask0 = 0;
    run(40);
    expect(runner.section.id).toBe('b');
    expect(runner.continuePlayer(1)).toBe(true); // today: false, no player 2 exists any more
  });

  // R1-11: the old continue screen resumed `section.music ?? mission.music`, so in a boss fight the
  // stage song came back. The in-world continue never stops the song: the boss song plays on.
  it('R1-11: continuing during a boss fight keeps the boss music', async () => {
    let press: Button | null = null;
    const g = await createHeadlessGame({ missionId: 'm0', bossRush: true, seed: 1, bot: false, autoContinue: false, input: () => press });
    try {
      expect(g.runUntil((x) => x.audio.songs.includes('boss'), 1200)).toBe(true);
      g.session.slots[0].lives = 1;
      g.step(30);
      const p = g.player(0)!;
      p.invulnTicks = 0;
      p.kill('bullet');
      expect(g.runUntil((x) => x.runner?.countdownHeld === true, 400)).toBe(true);
      press = 'start';
      g.step(2);
      press = null;
      g.step(10);
      expect(g.audio.songs[g.audio.songs.length - 1]).toBe('boss'); // today: 'm0'
    } finally {
      g.dispose();
    }
  });
});
