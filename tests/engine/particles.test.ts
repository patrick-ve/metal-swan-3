import { describe, expect, it } from 'vitest';
import { DEBRIS, type ParticlePreset, Particles, SPARK } from '../../src/engine/particles';
import { Rng } from '../../src/engine/rng';
import { Terrain, terrain } from '../../src/engine/terrain';
import { RecordingRenderer } from './helpers';

const DOT: ParticlePreset = { kind: 'pixel', life: 10, colors: [0xff0000ff, 0x0000ffff] };

describe('particles', () => {
  it('never exceeds the pool capacity', () => {
    const p = new Particles(64, new Rng(1));
    for (let i = 0; i < 500; i++) p.emit(DOT, i, 0);
    expect(p.count).toBe(64);
    p.burst(SPARK, 0, 0, 1000, 1, 2);
    expect(p.count).toBe(64);
  });

  it('particles die after their lifetime', () => {
    const p = new Particles(32, new Rng(1));
    p.emit(DOT, 0, 0);
    p.emit(DOT, 0, 0, 0, 0, 3);
    for (let i = 0; i < 3; i++) p.update();
    expect(p.count).toBe(1);
    for (let i = 0; i < 7; i++) p.update();
    expect(p.count).toBe(0);
  });

  it('applies gravity and drag; bouncing debris stays above the ground', () => {
    const def = terrain(400, 216);
    def.ground().at(0, 170).flat(400);
    const t = new Terrain(def.build());
    const p = new Particles(64, new Rng(4));
    p.debris(200, 160, 20);
    const r = new RecordingRenderer();
    for (let i = 0; i < 70; i++) {
      p.update(t);
      r.calls.length = 0;
      p.draw(r);
      for (const c of r.calls) if (c.op === 'rect') expect((c.args[1] as number) + (c.args[3] as number)).toBeLessThanOrEqual(171);
    }
  });

  it('is deterministic for the same rng seed', () => {
    const run = (): string => {
      const p = new Particles(128, new Rng(9));
      p.burst(DEBRIS, 100, 100, 30, 1, 3);
      p.sparks(50, 50, 10, 1);
      p.smoke(10, 10);
      p.casing(10, 10, -1);
      p.dust(10, 10);
      p.embers(10, 10);
      for (let i = 0; i < 20; i++) p.update();
      const r = new RecordingRenderer();
      p.draw(r);
      return JSON.stringify(r.calls.map((c) => c.args.slice(0, 5)));
    };
    expect(run()).toBe(run());
  });

  it('draws colour ramps, fades, sprite frames and culls off-screen particles', () => {
    const p = new Particles(16, new Rng(1));
    const FADE: ParticlePreset = { kind: 'rect', w: 3, h: 2, life: 10, fadeFrom: 0.5, colors: [1, 2], additive: true };
    const SPR: ParticlePreset = { kind: 'sprite', sprite: 'fx/test', frame: 2, ticksPerFrame: 2, life: 20 };
    p.emit(FADE, 10, 10);
    p.emit(SPR, 20, 20);
    p.emit(DOT, 2000, 10); // far outside the view
    for (let i = 0; i < 6; i++) p.update();
    const r = new RecordingRenderer();
    p.draw(r);
    const rect = r.calls.find((c) => c.op === 'rect');
    expect(rect?.args.slice(0, 5)).toEqual([9, 9, 3, 2, 2]); // second half of the ramp
    const o = rect?.args[5] as { alpha: number; blend: string };
    expect(o.blend).toBe('add');
    expect(o.alpha).toBeCloseTo(0.8, 6);
    const spr = r.calls.find((c) => c.op === 'sprite');
    expect(spr?.args.slice(0, 4)).toEqual(['fx/test', 5, 20, 20]);
    expect(r.calls.length).toBe(2);
    p.clear();
    expect(p.count).toBe(0);
  });
});
