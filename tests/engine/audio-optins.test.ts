/**
 * Rally wave C (PREP): the AudioOut opt-ins (docs/api/audio-pipeline.md "Mission rally"; engine/audio.ts):
 * the pure helpers of the engine voice, the radio chain, the doppler and the pan; the headless no-ops
 * (NullAudio, SimAudio: no log entries, null song state) and GameAudio's forwarding.
 */
import { describe, expect, it } from 'vitest';
import {
  closingSpeed,
  dopplerPitch,
  ENGINE_RPM_MAX,
  ENGINE_RPM_MIN,
  ENGINE_VOICES,
  engineParams,
  engineSteal,
  loopPanGain,
  NullAudio,
  RADIO_NEUTRAL,
  radioParams,
  SOUND_SPEED,
  stereoPan,
  type AudioOut,
  type EngineOpts,
  type RadioOpts,
} from '../../src/engine/audio';
import { GameAudio } from '../../src/game/app';
import { DEFAULT_SETTINGS } from '../../src/game/settings';
import { SimAudio } from '../../src/sim/stats';

describe('engineParams', () => {
  it('fires at rpm / 60 × cyl / 2 × pitch', () => {
    expect(engineParams({ rpm: 3000, load: 0 }).fire).toBeCloseTo(100, 6);
    expect(engineParams({ rpm: 3000, load: 0, cyl: 6 }).fire).toBeCloseTo(150, 6);
    expect(engineParams({ rpm: 3000, load: 0, pitch: 1.2 }).fire).toBeCloseTo(120, 6);
  });

  it('clamps the rpm and the inputs; never NaN', () => {
    expect(engineParams({ rpm: 10, load: 0 }).fire).toBeCloseTo((ENGINE_RPM_MIN / 60) * 2, 6);
    expect(engineParams({ rpm: 1e6, load: 0 }).fire).toBeCloseTo((ENGINE_RPM_MAX / 60) * 2, 6);
    const p = engineParams({ rpm: NaN, load: NaN, pan: NaN, vol: NaN, cyl: NaN, pitch: NaN, turbo: NaN } as EngineOpts);
    for (const [k, v] of Object.entries(p)) expect(Number.isFinite(v), k).toBe(true);
    expect(engineParams({ rpm: 3000, load: 0, pan: 5 }).pan).toBe(1);
    expect(engineParams({ rpm: 3000, load: 0, pan: -5 }).pan).toBe(-1);
    expect(engineParams({ rpm: 3000, load: 0, vol: 0 }).gain).toBe(0);
  });

  it('load makes it louder, brighter and rougher; the turbo needs load and rpm', () => {
    const idle = engineParams({ rpm: 4000, load: 0, turbo: 1 });
    const full = engineParams({ rpm: 4000, load: 1, turbo: 1 });
    expect(full.gain).toBeGreaterThan(idle.gain);
    expect(full.cutoff).toBeGreaterThan(idle.cutoff);
    expect(full.noise).toBeGreaterThan(idle.noise);
    expect(idle.turbo).toBe(0);
    expect(full.turbo).toBeGreaterThan(0);
    expect(engineParams({ rpm: 4000, load: 1 }).turbo).toBe(0);
    expect(engineParams({ rpm: 8000, load: 1, turbo: 1 }).turboFreq).toBeGreaterThan(full.turboFreq);
  });

  it('reuses the out object', () => {
    const out = engineParams({ rpm: 1000, load: 0 });
    expect(engineParams({ rpm: 2000, load: 1 }, out)).toBe(out);
    expect(out.fire).toBeCloseTo((2000 / 60) * 2, 6);
  });
});

describe('engineSteal', () => {
  it('fills free voices first, then replaces the quietest only for a louder one', () => {
    expect(ENGINE_VOICES).toBe(4);
    expect(engineSteal([], 0.1)).toBe(0);
    expect(engineSteal([0.5, 0.2], 0.1)).toBe(2);
    expect(engineSteal([0.5, 0.2, 0.8, 0.3], 0.25)).toBe(1);
    expect(engineSteal([0.5, 0.2, 0.8, 0.3], 0.2)).toBe(-1);
    expect(engineSteal([0.5, 0.2, 0.8, 0.3], 0.1)).toBe(-1);
  });
});

describe('radioParams', () => {
  it('null is neutral: flat filters, full signal, no static', () => {
    expect(radioParams(null)).toEqual(RADIO_NEUTRAL);
    const flat = radioParams({ speaker: 0 });
    expect(flat.hp).toBeCloseTo(10, 6);
    expect(flat.lp).toBeCloseTo(20000, 3);
  });

  it('the speaker band-passes, the muffle closes, signal and static are levels', () => {
    const r = radioParams({});
    expect(r.hp).toBeCloseTo(180, 6);
    expect(r.lp).toBeCloseTo(4500, 3);
    expect(r.muffleHz).toBeCloseTo(20000, 3);
    expect(r.signal).toBe(1);
    expect(r.static).toBe(0);
    const t = radioParams({ muffle: 1, signal: 0.1, static: 0.6, ramp: 99 });
    expect(t.muffleHz).toBeCloseTo(300, 6);
    expect(t.signal).toBeCloseTo(0.1, 9);
    expect(t.static).toBeCloseTo(0.6, 9);
    expect(t.ramp).toBe(5);
    const half = radioParams({ muffle: 0.5 });
    expect(half.muffleHz).toBeLessThan(20000);
    expect(half.muffleHz).toBeGreaterThan(300);
    expect(radioParams({ static: 7, signal: -1 } as RadioOpts)).toMatchObject({ static: 1, signal: 0 });
  });
});

describe('doppler and pan', () => {
  it('dopplerPitch: up while approaching, down while leaving, 1 at rest, clamped', () => {
    expect(dopplerPitch(0)).toBe(1);
    expect(dopplerPitch(30)).toBeCloseTo(SOUND_SPEED / (SOUND_SPEED - 30), 9);
    expect(dopplerPitch(-30)).toBeCloseTo(SOUND_SPEED / (SOUND_SPEED + 30), 9);
    expect(dopplerPitch(30, 2)).toBeCloseTo(SOUND_SPEED / (SOUND_SPEED - 60), 9);
    expect(dopplerPitch(1e9)).toBe(2);
    expect(dopplerPitch(-1e9)).toBe(0.5);
    expect(dopplerPitch(NaN)).toBe(1);
  });

  it('closingSpeed: positive when the source comes closer', () => {
    // Source 100 m ahead (+z), driving towards the listener at 20 m/s.
    expect(closingSpeed(0, 100, 0, -20)).toBeCloseTo(20, 9);
    expect(closingSpeed(0, 100, 0, 20)).toBeCloseTo(-20, 9);
    expect(closingSpeed(50, 0, 0, 30)).toBeCloseTo(0, 9);
    expect(closingSpeed(0, 0, 5, 5)).toBe(0);
  });

  it('stereoPan: right is positive, never fully one-sided, centred when close', () => {
    expect(stereoPan(10, 0)).toBeCloseTo(0.85, 9);
    expect(stereoPan(-10, 0)).toBeCloseTo(-0.85, 9);
    expect(stereoPan(0, 50)).toBe(0);
    expect(stereoPan(0.5, 0.5)).toBe(0);
    expect(stereoPan(10, 10)).toBeCloseTo(0.85 / Math.SQRT2, 9);
  });

  it('loopPanGain keeps a mono loop at its unpanned level (never above the louder side)', () => {
    expect(loopPanGain(0, true)).toBeCloseTo(Math.SQRT2, 9);
    expect(loopPanGain(1, true)).toBeCloseTo(1, 9);
    expect(loopPanGain(-1, true)).toBeCloseTo(1, 9);
    expect(loopPanGain(0.4, false)).toBe(1);
    for (const p of [-1, -0.6, -0.2, 0, 0.3, 0.7, 1]) {
      const x = ((p + 1) / 2) * (Math.PI / 2);
      const louder = Math.max(Math.cos(x), Math.sin(x)) * loopPanGain(p, true);
      expect(louder, String(p)).toBeCloseTo(1, 9);
    }
  });
});

describe('headless no-ops', () => {
  it('NullAudio: the opt-ins log nothing and report no song', () => {
    const a = new NullAudio();
    expect(a.songState()).toBeNull();
    const off = a.onSongEnd();
    expect(typeof off).toBe('function');
    off();
    a.setRadio();
    a.engine();
    a.stopEngine();
    a.music('rally-lap1', { once: true });
    expect(a.log).toEqual(['music:rally-lap1']);
  });

  it('SimAudio: the opt-ins are no-ops (no missing ids, no songs counted)', () => {
    const a = new SimAudio();
    const out: AudioOut = a;
    expect(out.songState?.()).toBeNull();
    out.onSongEnd?.(() => {})();
    out.setRadio?.({ muffle: 1, static: 1 });
    out.engine?.('car-0', { rpm: 3000, load: 1 });
    out.stopEngine?.('car-0');
    expect(a.missingSfx.size).toBe(0);
    expect(a.songs).toEqual([]);
  });

  it('GameAudio forwards the opt-ins, and falls back when the output has none', () => {
    const calls: string[] = [];
    const inner: AudioOut = {
      sfx: () => {},
      music: () => {},
      voice: () => {},
      setVolume: () => {},
      stopAll: () => {},
      songState: () => ({ id: 'x', source: 'stream', position: 1, duration: 2, ended: false, paused: false }),
      onSongEnd: (fn) => {
        fn('x');
        return () => calls.push('off');
      },
      setRadio: (o) => calls.push(`radio:${o ? o.muffle : 'null'}`),
      engine: (k, o) => calls.push(`engine:${k}:${o.rpm}`),
      stopEngine: (k, f) => calls.push(`stop:${k}:${f}`),
    };
    const g = new GameAudio(inner, { ...DEFAULT_SETTINGS });
    expect(g.songState()?.source).toBe('stream');
    const ended: string[] = [];
    g.onSongEnd((id) => ended.push(id))();
    g.setRadio({ muffle: 1 });
    g.setRadio(null);
    g.engine('car-1', { rpm: 2500, load: 0.5 });
    g.stopEngine('car-1', 8);
    expect(ended).toEqual(['x']);
    expect(calls).toEqual(['off', 'radio:1', 'radio:null', 'engine:car-1:2500', 'stop:car-1:8']);
    const bare = new GameAudio(new NullAudio(), { ...DEFAULT_SETTINGS });
    expect(bare.songState()).toBeNull();
    expect(typeof bare.onSongEnd(() => {})).toBe('function');
  });
});
