import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/events';
import { FixedStepLoop } from '../../src/engine/loop';
import {
  angleDiff,
  approach,
  circleOverlapsRect,
  clamp,
  contains,
  overlaps,
  rectAt,
  segmentRectT,
  sweptRectT,
  wrap,
} from '../../src/engine/math';
import { Rng, hashString } from '../../src/engine/rng';
import { type Scene, SceneManager } from '../../src/engine/scene';
import { MemoryStore, PrefixedStore, loadJson, saveJson } from '../../src/engine/storage';
import { RecordingRenderer } from './helpers';

describe('math', () => {
  it('basic helpers', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(approach(1, 5, 1.5)).toBe(2.5);
    expect(approach(5, 1, 10)).toBe(1);
    expect(wrap(-1, 0, 10)).toBe(9);
    expect(wrap(25, 0, 10)).toBe(5);
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(-0.2, 12);
    expect(angleDiff(3, -3)).toBeCloseTo(2 * Math.PI - 6, 12);
  });

  it('rects: overlap is strict, contains is half-open, rectAt mirrors', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: 9.5, y: 0, w: 5, h: 5 })).toBe(true);
    expect(contains(a, 0, 0)).toBe(true);
    expect(contains(a, 10, 5)).toBe(false);
    expect(rectAt(100, 50, { x: 2, y: -10, w: 6, h: 10 })).toEqual({ x: 102, y: 40, w: 6, h: 10 });
    expect(rectAt(100, 50, { x: 2, y: -10, w: 6, h: 10 }, true)).toEqual({ x: 92, y: 40, w: 6, h: 10 });
    expect(circleOverlapsRect(15, 5, 5.5, a)).toBe(true);
    expect(circleOverlapsRect(16, 5, 5.5, a)).toBe(false);
  });

  it('segment and swept tests', () => {
    const b = { x: 10, y: 0, w: 10, h: 10 };
    expect(segmentRectT(0, 5, 20, 5, b)).toBeCloseTo(0.5, 12);
    expect(segmentRectT(0, 20, 20, 20, b)).toBe(-1);
    expect(segmentRectT(15, 5, 30, 5, b)).toBe(0);
    // A 2×2 box moving 30 px right passes a thin 1 px wall: hit at t = (10 - 2) / 30.
    const a = { x: 0, y: 4, w: 2, h: 2 };
    expect(sweptRectT(a, 30, 0, { x: 10, y: 0, w: 1, h: 10 })).toBeCloseTo(8 / 30, 12);
    expect(sweptRectT(a, 30, 0, { x: 10, y: 6, w: 1, h: 10 })).toBe(-1); // only touches
  });
});

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const sa = Array.from({ length: 50 }, () => a.next());
    const sb = Array.from({ length: 50 }, () => b.next());
    const sc = Array.from({ length: 50 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Rng('level-1').next()).toBe(new Rng(hashString('level-1')).next());
    expect(new Rng(42).seed).toBe(42);
  });

  it('helpers stay in range', () => {
    const r = new Rng(7);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const v = r.int(0, 3);
      counts[v]++;
      const f = r.range(-2, 2);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(2);
    }
    for (const c of counts) expect(c).toBeGreaterThan(800);
    expect([1, -1]).toContain(r.sign());
    expect(r.pick(['a', 'b'])).toMatch(/[ab]/);
    expect(() => r.pick([])).toThrow();
    expect(r.weighted([0, 0, 5])).toBe(2);
    expect(r.weighted([0, 0])).toBe(-1);
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('fork is stable and does not advance the parent', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    const fa = a.fork('fx');
    expect(a.next()).toBe(b.next()); // forking did not advance the parent
    // Same parent state + same salt → same child stream; other salts differ.
    const fb = new Rng(5).fork('fx');
    expect([fa.next(), fa.next()]).toEqual([fb.next(), fb.next()]);
    expect(new Rng(5).fork('fx').next()).not.toBe(new Rng(5).fork('ai').next());
  });

  it('state can be saved and restored', () => {
    const r = new Rng(9);
    r.next();
    const s = r.getState();
    const x = [r.next(), r.next()];
    r.setState(s);
    expect([r.next(), r.next()]).toEqual(x);
  });
});

describe('events', () => {
  it('delivers typed payloads; unsubscribe and once work; listener errors are isolated', () => {
    const bus = new EventBus<{ score: number; hit: { id: number } }>();
    const got: number[] = [];
    const off = bus.on('score', (n) => got.push(n));
    bus.once('score', (n) => got.push(n * 10));
    bus.on('hit', () => {
      throw new Error('boom');
    });
    const hits: number[] = [];
    bus.on('hit', (h) => hits.push(h.id));
    const err = console.error;
    console.error = () => {};
    try {
      bus.emit('score', 1);
      bus.emit('score', 2);
      off();
      bus.emit('score', 3);
      bus.emit('hit', { id: 7 });
    } finally {
      console.error = err;
    }
    expect(got).toEqual([1, 10, 2]);
    expect(hits).toEqual([7]);
    expect(bus.count('score')).toBe(0);
  });

  it('subscribing during emit applies to the next emit', () => {
    const bus = new EventBus<{ e: number }>();
    let late = 0;
    bus.on('e', () => {
      bus.on('e', () => late++);
    });
    bus.emit('e', 0);
    expect(late).toBe(0);
    bus.emit('e', 0);
    expect(late).toBe(1);
  });
});

describe('loop', () => {
  it('runs whole ticks and carries the remainder', () => {
    const loop = new FixedStepLoop();
    let n = 0;
    const tick = (): void => {
      n++;
    };
    expect(loop.advance(10, tick)).toBe(0);
    expect(loop.advance(10, tick)).toBe(1); // 20 ms ≥ 16.67
    loop.reset();
    for (let i = 0; i < 60; i++) loop.advance(1000 / 60, tick);
    expect(n).toBe(61);
  });

  it('snaps vsync jitter and caps catch-up', () => {
    const loop = new FixedStepLoop({ maxSteps: 4 });
    let n = 0;
    const tick = (): void => {
      n++;
    };
    // Jittery 60 Hz frames: always exactly one tick each.
    for (const dt of [16.2, 17.1, 16.5, 16.9, 16.0, 17.3]) expect(loop.advance(dt, tick)).toBe(1);
    // 144 Hz: about 60 ticks per 144 frames.
    n = 0;
    loop.reset();
    for (let i = 0; i < 144; i++) loop.advance(1000 / 144, tick);
    expect(n).toBeGreaterThanOrEqual(59);
    expect(n).toBeLessThanOrEqual(60);
    // A 2 s stall runs at most 4 ticks and drops the rest.
    expect(loop.advance(2000, tick)).toBe(4);
    expect(loop.dropped).toBeGreaterThan(100);
    expect(loop.advance(1000 / 60, tick)).toBe(1);
    loop.paused = true;
    expect(loop.advance(100, tick)).toBe(0);
  });
});

describe('scene manager', () => {
  function scene(log: string[], name: string, transparent = false): Scene {
    return {
      transparent,
      enter: () => log.push(`${name}:enter`),
      exit: () => log.push(`${name}:exit`),
      pause: () => log.push(`${name}:pause`),
      resume: () => log.push(`${name}:resume`),
      update: () => log.push(`${name}:update`),
      draw: () => log.push(`${name}:draw`),
    };
  }

  it('push / pop / replace call the hooks; only the top updates; overlays draw over', () => {
    const log: string[] = [];
    const m = new SceneManager();
    const r = new RecordingRenderer();
    m.push(scene(log, 'a'));
    m.push(scene(log, 'pause', true));
    m.update();
    m.draw(r);
    m.pop();
    m.replace(scene(log, 'b'));
    expect(log).toEqual([
      'a:enter',
      'a:pause',
      'pause:enter',
      'pause:update',
      'a:draw',
      'pause:draw',
      'pause:exit',
      'a:resume',
      'a:exit',
      'b:enter',
    ]);
  });

  it('fades out, swaps at full cover, fades in', () => {
    const log: string[] = [];
    const m = new SceneManager();
    const r = new RecordingRenderer();
    m.push(scene(log, 'a'));
    m.replace(scene(log, 'b'), { fade: 20 });
    const alphas: number[] = [];
    for (let i = 0; i < 25; i++) {
      m.update();
      r.calls.length = 0;
      m.draw(r);
      const f = r.calls.find((c) => c.op === 'fade');
      alphas.push(f ? (f.args[1] as number) : 0);
      if (i === 8) expect(log.includes('b:enter')).toBe(false);
      if (i === 10) expect(log.includes('b:enter')).toBe(true);
    }
    expect(Math.max(...alphas)).toBe(1);
    expect(alphas[24]).toBe(0);
    expect(m.busy).toBe(false);
  });
});

describe('storage', () => {
  it('memory store, prefixes and JSON helpers', () => {
    const mem = new MemoryStore();
    const s = new PrefixedStore(mem, 'ms3:');
    expect(saveJson(s, 'cfg', { vol: 0.5 })).toBe(true);
    expect(mem.get('ms3:cfg')).toBe('{"vol":0.5}');
    expect(s.keys()).toEqual(['cfg']);
    expect(loadJson(s, 'cfg', { vol: 1 })).toEqual({ vol: 0.5 });
    expect(loadJson(s, 'missing', 3)).toBe(3);
    mem.set('ms3:bad', '{oops');
    expect(loadJson(s, 'bad', 'fallback')).toBe('fallback');
    expect(loadJson(s, 'cfg', 0, (v) => (typeof v === 'number' ? v : null))).toBe(0);
    s.remove('cfg');
    expect(s.get('cfg')).toBeNull();
  });
});
