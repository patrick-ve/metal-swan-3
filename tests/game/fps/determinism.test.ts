import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { ACTION_BIT as B } from '../../../src/engine/input-actions';
import { FpsGame } from '../../../src/game/fps/game';
import { getFpsFloor } from '../../../src/game/fps/registry';
import type { FpsInput } from '../../../src/game/fps/types';
import { PlayerSlot } from '../../../src/game/session';
import { createHeadlessFps, type FpsScript } from '../../../src/sim/headless-fps';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

/** A timeline over floor 0: walk east, turn, open the door, strafe, push, look around. */
function actions(t: number): number {
  if (t < 40) return B.forward;
  if (t < 60) return B.turnLeft | B.run;
  if (t < 70) return t % 2 ? B.use : 0;
  if (t < 140) return B.forward | (t > 100 ? B.strafeLeft : 0);
  if (t < 160) return B.strafe | B.turnRight;
  return t % 30 < 15 ? B.forward | B.run : B.back;
}
const script: FpsScript = {
  actions,
  analog: (t, out) => {
    out.turn = t > 200 ? ((t * 7) % 23) - 11 : 0;
    out.moveX = t > 250 ? ((t * 13) % 255) - 127 : 0;
  },
};

describe('fps determinism', () => {
  it('same seed + timeline → same stateHash (through the scene and the input layer)', async () => {
    const hashes: number[][] = [];
    for (let run = 0; run < 2; run++) {
      const h = await createHeadlessFps({ floor: 0, seed: 7, input: script, captureConsole: false });
      const seq: number[] = [];
      for (let k = 0; k < 6; k++) {
        h.step(60);
        if (k === 2) h.renderFrame(); // drawing never changes the state
        seq.push(h.game!.stateHash());
      }
      hashes.push(seq);
      h.dispose();
    }
    expect(hashes[0]).toEqual(hashes[1]);
    expect(new Set(hashes[0]).size).toBe(6);
  });

  it('a different timeline gives a different hash; the hash is stable without input', async () => {
    const a = await createHeadlessFps({ floor: 0, seed: 7, input: script, captureConsole: false });
    const b = await createHeadlessFps({ floor: 0, seed: 7, input: { actions: (t) => actions(t + 1) }, captureConsole: false });
    a.step(200);
    b.step(200);
    expect(a.game!.stateHash()).not.toBe(b.game!.stateHash());
    const h0 = a.game!.stateHash();
    expect(a.game!.stateHash()).toBe(h0);
    a.dispose();
    b.dispose();
  });

  it('FpsGame alone: identical inputs → identical hashes every tick', () => {
    const make = () => new FpsGame({ floor: getFpsFloor('fps-0')!, difficulty: 'normal', seed: 3, slot: new PlayerSlot(0), carry: null, audio: new NullAudio() });
    const g1 = make();
    const g2 = make();
    const i: FpsInput = { held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 };
    let prev = 0;
    for (let t = 0; t < 400; t++) {
      const m = actions(t);
      i.pressed = m & ~prev;
      i.held = m;
      prev = m;
      i.turn = (t % 9) - 4;
      g1.step(i);
      g2.step(i);
      expect(g1.stateHash()).toBe(g2.stateHash());
    }
    expect(g1.player.x).not.toBe(1.5);
  });
});
