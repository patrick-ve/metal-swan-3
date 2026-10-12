/**
 * Review round 1: engine script helpers. Regression tests: each asserts the correct behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import { race, ScriptRunner, type ScriptGen } from '../../src/engine/script';

describe('review r1: scripts', () => {
  // R1-24: race() wraps a ScriptHandle in a watcher coroutine (toCoroutine → once(() => h.done))
  // and, when another item wins, cancels only that watcher. The raced script keeps running,
  // although script.ts says "the others are cancelled" and docs/api/sim.md lists handles as race
  // items. A boss doing `yield* race(world.scripts.run(volley), 120)` keeps the volley going.
  it('R1-24: race() cancels a losing script handle', () => {
    const runner = new ScriptRunner<object>({});
    let ticks = 0;
    const attack = runner.run(function* attack(): ScriptGen {
      for (;;) {
        ticks++;
        yield;
      }
    });
    let finished = false;
    runner.run(function* main(): ScriptGen {
      yield* race(attack, 10);
      finished = true;
    });
    for (let i = 0; i < 30; i++) runner.update();
    expect(finished).toBe(true);
    expect(attack.done).toBe(true); // today: false, it ran all 30 ticks
    expect(ticks).toBeLessThan(15);
  });
});
