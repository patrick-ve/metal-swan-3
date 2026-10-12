import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SfxRecipe, Wave } from '../../src/engine/synth';
import { defineSfx, hasSfx, listSfx, recipeLength, renderRecipe, renderSfx, SAMPLE_RATE, sfxLimits } from '../../src/engine/synth';

afterEach(() => vi.restoreAllMocks());

function peak(a: Float32Array): number {
  let p = 0;
  for (const v of a) p = Math.max(p, Math.abs(v));
  return p;
}

function allFinite(a: Float32Array): boolean {
  for (const v of a) if (!Number.isFinite(v)) return false;
  return true;
}

describe('synth', () => {
  it('renders the expected length with finite samples and peak <= 1', () => {
    const r: SfxRecipe = { layers: [{ wave: 'square', freq: 440, env: { a: 0.01, d: 0.1 } }] };
    const out = renderRecipe(r);
    expect(out.length).toBe(Math.ceil(0.11 * SAMPLE_RATE));
    expect(allFinite(out)).toBe(true);
    expect(peak(out)).toBeLessThanOrEqual(1);
    expect(peak(out)).toBeGreaterThan(0.1);
  });

  it('every waveform renders cleanly, with sweeps, filters and effects', () => {
    const waves: Wave[] = ['sine', 'square', 'pulse', 'saw', 'triangle', 'noise', 'metal'];
    for (const wave of waves) {
      const out = renderRecipe({
        layers: [
          {
            wave,
            freq: 300,
            to: 1200,
            duty: 0.125,
            dutyTo: 0.5,
            vibrato: { rate: 6, depth: 0.5, delay: 0.02 },
            arp: [0, 4, 7],
            env: { a: 0.005, d: 0.05, s: 0.5, hold: 0.05, r: 0.05 },
            filter: { type: 'lowpass', freq: 4000, to: 500, q: 2 },
            drive: 2,
            crush: 5,
          },
        ],
        echo: { delay: 0.05, feedback: 0.4 },
        downsample: 2,
      });
      expect(allFinite(out), wave).toBe(true);
      expect(peak(out), wave).toBeLessThanOrEqual(1);
      expect(peak(out), wave).toBeGreaterThan(0.01);
    }
  });

  it('soft-limits very loud recipes below 1', () => {
    const out = renderRecipe({ vol: 8, layers: [{ wave: 'square', freq: 110, env: { hold: 0.05 } }, { wave: 'saw', freq: 55 }] });
    expect(peak(out)).toBeLessThanOrEqual(Math.fround(0.98));
    expect(peak(out)).toBeGreaterThan(0.9);
  });

  it('is deterministic and seeds noise per id', () => {
    const r: SfxRecipe = { layers: [{ wave: 'noise', env: { d: 0.05 } }] };
    expect(Array.from(renderRecipe(r, 5))).toEqual(Array.from(renderRecipe(r, 5)));
    defineSfx('test/noise-a', r);
    defineSfx('test/noise-b', r);
    const a = renderSfx('test/noise-a') as Float32Array;
    const b = renderSfx('test/noise-b') as Float32Array;
    expect(a.length).toBe(b.length);
    expect(Array.from(a.slice(100, 120))).not.toEqual(Array.from(b.slice(100, 120)));
  });

  it('counts delays, echo tails and the length cap', () => {
    expect(recipeLength({ layers: [{ wave: 'sine', delay: 0.2, env: { a: 0, d: 0.1 } }] })).toBeCloseTo(0.3, 6);
    const echo = recipeLength({ layers: [{ wave: 'sine', env: { d: 0.1 } }], echo: { delay: 0.1, feedback: 0.5 } });
    expect(echo).toBeGreaterThan(0.6);
    expect(recipeLength({ layers: [{ wave: 'sine', env: { d: 2 } }], length: 0.25 })).toBe(0.25);
  });

  it('registry: define, list, cache, unknown ids and limits', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const id of ['ui/move', 'ui/confirm', 'ui/cancel', 'ui/pause']) {
      expect(hasSfx(id)).toBe(true);
      const s = renderSfx(id) as Float32Array;
      expect(s.length).toBeGreaterThan(1000);
      expect(peak(s)).toBeLessThanOrEqual(1);
    }
    expect(listSfx('ui/')).toEqual(expect.arrayContaining(['ui/move', 'ui/confirm', 'ui/cancel', 'ui/pause']));
    defineSfx('test/blip', { layers: [{ wave: 'sine', env: { d: 0.02 } }], voices: 2, gap: 0.05 });
    expect(renderSfx('test/blip')).toBe(renderSfx('test/blip'));
    expect(sfxLimits('test/blip')).toEqual({ voices: 2, gap: 0.05 });
    expect(sfxLimits('nope')).toEqual({ voices: 4, gap: 0.015 });
    expect(renderSfx('test/nope')).toBeNull();
    renderSfx('test/nope');
    expect(warn).toHaveBeenCalledTimes(1);
    // Redefining drops the cache.
    const before = renderSfx('test/blip');
    defineSfx('test/blip', { layers: [{ wave: 'sine', env: { d: 0.03 } }] });
    expect(renderSfx('test/blip')).not.toBe(before);
  });
});
