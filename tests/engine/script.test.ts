import { describe, expect, it } from 'vitest';
import { Entity } from '../../src/engine/entity';
import { ScriptRunner, type ScriptGen, all, race, until, wait, waitAllDead, waitCamera } from '../../src/engine/script';
import { World } from '../../src/engine/world';

/** Runner with a manual tick counter, for timing assertions. */
function runner(): { r: ScriptRunner<{ tick: number }>; ctx: { tick: number }; step: (n?: number) => void } {
  const ctx = { tick: 0 };
  const r = new ScriptRunner(ctx);
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      ctx.tick++;
      r.update();
    }
  };
  return { r, ctx, step };
}

describe('scripts', () => {
  it('runs to the first yield at once; numbers wait exactly that many ticks', () => {
    const { r, ctx, step } = runner();
    const log: number[] = [];
    r.run(function* (c) {
      log.push(c.tick);
      yield 3;
      log.push(c.tick);
      yield;
      log.push(c.tick);
      yield wait(0); // < 1 counts as 1
      log.push(c.tick);
    });
    expect(log).toEqual([0]);
    step(10);
    expect(log).toEqual([0, 3, 4, 5]);
    expect(r.count).toBe(0);
    expect(ctx.tick).toBe(10);
  });

  it('predicates resume on the first later tick where they hold', () => {
    const { r, ctx, step } = runner();
    let at = -1;
    r.run(function* () {
      yield until(() => ctx.tick >= 4);
      at = ctx.tick;
    });
    step(3);
    expect(at).toBe(-1);
    step(1);
    expect(at).toBe(4);
    // A predicate that is already true still waits for the next tick.
    let at2 = -1;
    r.run(function* () {
      yield () => true;
      at2 = ctx.tick;
    });
    expect(at2).toBe(-1);
    step(1);
    expect(at2).toBe(5);
  });

  it('nests with yield* and supports all / race', () => {
    const { r, ctx, step } = runner();
    const log: string[] = [];
    function* sub(name: string, ticks: number): ScriptGen {
      log.push(`${name}+${ctx.tick}`);
      yield ticks;
      log.push(`${name}-${ctx.tick}`);
    }
    r.run(function* () {
      yield* sub('a', 2);
      yield* all(sub('b', 5), sub('c', 3), 4);
      log.push(`all@${ctx.tick}`);
      yield* race(sub('d', 10), 2);
      log.push(`race@${ctx.tick}`);
    });
    step(30);
    expect(log).toEqual(['a+0', 'a-2', 'b+2', 'c+2', 'c-5', 'b-7', 'all@7', 'd+7', 'race@9']);
  });

  it('cancels scripts when their owner dies, and on cancel()', () => {
    const { r, step } = runner();
    const owner = { dead: false, removed: false };
    let ticks = 0;
    let cleaned = false;
    r.run(
      function* () {
        try {
          for (;;) {
            ticks++;
            yield;
          }
        } finally {
          cleaned = true;
        }
      },
      { owner },
    );
    step(3);
    owner.dead = true;
    step(3);
    expect(ticks).toBe(4);
    expect(cleaned).toBe(true);
    expect(r.count).toBe(0);
    let n = 0;
    const h = r.run(function* () {
      for (;;) {
        n++;
        yield;
      }
    });
    step(2);
    h.cancel();
    step(2);
    expect(n).toBe(3);
    expect(h.done && h.cancelled).toBe(true);
  });

  it('isolates errors: a throwing script stops, others go on', () => {
    const { r, step } = runner();
    const errors: string[] = [];
    r.onError = (name) => errors.push(name);
    let good = 0;
    const bad = r.run(function* boss() {
      yield 2;
      throw new Error('oops');
    });
    r.run(function* () {
      for (;;) {
        good++;
        yield;
      }
    });
    step(5);
    expect(errors).toEqual(['boss']);
    expect(bad.failed).toBe(true);
    expect(good).toBe(6);
  });

  it('scripts started during update first step at once, then next update', () => {
    const { r, ctx, step } = runner();
    const log: string[] = [];
    r.run(function* () {
      yield;
      r.run(function* () {
        log.push(`child@${ctx.tick}`);
        yield;
        log.push(`child@${ctx.tick}`);
      });
    });
    step(3);
    expect(log).toEqual(['child@1', 'child@2']);
  });
});

describe('scripts in a World', () => {
  class Grunt extends Entity {}

  it('waitCamera and waitAllDead(tag) use the world running the script', () => {
    const w = new World({ seed: 3 });
    w.camera.bounds = { x: 0, y: 0, w: 5000, h: 216 };
    const log: string[] = [];
    let grunts: Grunt[] = [];
    w.scripts.run(function* () {
      yield waitCamera(500);
      log.push(`camera@${w.tick}`);
      grunts = [0, 1].map((i) => w.add(new Grunt(w, 900 + i * 20, 100)).addTag('wave'));
      yield waitAllDead('wave');
      log.push(`clear@${w.tick}`);
      yield waitAllDead(grunts);
      log.push('done');
    });
    for (let i = 0; i < 5; i++) w.update();
    expect(log).toEqual([]);
    w.camera.scroll = 'free';
    w.camera.x = 600;
    w.update();
    expect(log).toEqual(['camera@5']);
    w.update();
    for (const g of grunts) g.die();
    w.update();
    w.update();
    expect(log).toEqual(['camera@5', 'clear@7', 'done']);
  });

  it('owner-bound world scripts stop when the entity is removed', () => {
    const w = new World();
    const e = w.add(new Grunt(w, 0, 0));
    e.despawnMargin = Infinity;
    let n = 0;
    w.scripts.run(
      function* () {
        for (;;) {
          n++;
          yield 1;
        }
      },
      { owner: e },
    );
    w.update();
    w.update();
    e.remove();
    w.update();
    w.update();
    expect(n).toBe(3);
  });

  it('helpers outside a script need explicit arguments', () => {
    expect(() => waitCamera(10)).toThrow(/outside a running script/);
    expect(waitCamera(10, { x: 20 })()).toBe(true);
  });
});
