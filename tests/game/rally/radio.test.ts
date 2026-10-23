/**
 * FILE FM's director (src/game/rally/radio.ts; docs/api/rally.md "C.R The radio"): the race's moments
 * and events to the DJ's lines, the songs and jingles on the music lane, the tunnel static, the
 * ticker, the settings, the output's clock and voice, the clean-up, and that the radio never changes
 * the race (a stateHash with and without it).
 */
import { describe, expect, it } from 'vitest';
import type { AudioOut, MusicOpts, RadioOpts, SongState } from '../../../src/engine/audio';
import type { SayOpts } from '../../../src/engine/samples';
import { DJ_SPEAKER, RADIO_STATION, tickerText } from '../../../src/game/content/rally/radio/lines';
import type { RallyTrack } from '../../../src/game/rally/api';
import { JINGLE_TEXT, RallyRadio, TICKER_NO_SIGNAL, type RadioStage } from '../../../src/game/rally/radio';
import type { RallyRunner } from '../../../src/game/rally/runner';
import { race, ringTrack } from './helpers';

/** A recording output with a switchable take, clock and "speaking" flag. */
class FakeAudio implements AudioOut {
  readonly log: string[] = [];
  readonly radio: (RadioOpts | null)[] = [];
  readonly takes = new Set<string>();
  speakingNow = false;
  clock: SongState | null = null;
  endFn: ((id: string) => void) | null = null;
  sfx(): void {}
  music(id: string | null, o?: MusicOpts): void {
    this.log.push(`music:${id}${o?.once ? ':once' : ''}`);
  }
  voice(): void {}
  setVolume(): void {}
  stopAll(): void {}
  say(text: string, speaker?: string, o?: SayOpts): void {
    this.log.push(`say:${speaker}:${o?.important ? '!' : ''}${text}`);
  }
  speaking(): boolean {
    return this.speakingNow;
  }
  hasVoice(text: string): boolean {
    return this.takes.has(text);
  }
  songState(): SongState | null {
    return this.clock;
  }
  onSongEnd(fn: (id: string) => void): () => void {
    this.endFn = fn;
    return () => {
      this.endFn = null;
    };
  }
  setRadio(o: RadioOpts | null): void {
    this.radio.push(o);
  }
}

interface Rig {
  runner: RallyRunner;
  audio: FakeAudio;
  radio: RallyRadio;
  trace: string[];
  /** Step the radio n times at a stage (the race does not move). */
  idle(stage: RadioStage, n: number): void;
  /** The ids of the lines said since `from` (index into `trace`). */
  said(from?: number): string[];
}

function rig(o: { track?: RallyTrack; players?: 1 | 2; on?: () => boolean; first?: RadioStage } = {}): Rig {
  const h = race({ track: o.track, players: o.players ?? 1 });
  const audio = new FakeAudio();
  const trace: string[] = [];
  const radio = new RallyRadio({ audio, runner: h.runner, on: o.on, trace: (l) => trace.push(l) });
  const r: Rig = {
    runner: h.runner,
    audio,
    radio,
    trace,
    idle(stage, n) {
      for (let i = 0; i < n; i++) radio.step(stage);
    },
    said(from = 0) {
      return trace
        .slice(from)
        .filter((l) => / SAY /.test(l))
        .map((l) => /SAY\s+(\S+)/.exec(l)![1]);
    },
  };
  return r;
}

/** A rig whose radio is quiet in the race (the opening lines done). */
function quiet(o: Parameters<typeof rig>[0] = {}): Rig {
  const r = rig(o);
  r.idle('race', 1200);
  expect(r.radio.sched.onAir).toBeNull();
  return r;
}

describe('FILE FM: the race moments', () => {
  it('the fly-over: FILE FM opens with its sting (then the first song), intro 1; the countdown: the start line cuts in; after GO intro 2, then 3', () => {
    const r = rig();
    r.idle('intro', 30);
    // Integrator (wave C): after the glitch the station opens with the sting; the lap's song follows it.
    expect(r.audio.log[0]).toBe('music:rally-jingle-3:once');
    expect(r.said()).toEqual(['rally/dj/intro/1']);
    r.idle('grid', 1);
    expect(r.said()).toEqual(['rally/dj/intro/1', 'rally/dj/start/1']);
    expect(r.trace.some((l) => /CUT\s+rally\/dj\/intro\/1/.test(l))).toBe(true);
    r.idle('grid', 179);
    r.idle('race', 1200);
    expect(r.said()).toEqual(['rally/dj/intro/1', 'rally/dj/start/1', 'rally/dj/intro/2', 'rally/dj/intro/3']);
  });

  it('a direct start (no fly-over): no intro 1; the start line on the grid', () => {
    const r = rig();
    r.idle('grid', 5);
    expect(r.said()).toEqual(['rally/dj/start/1']);
  });

  it('the leading player\'s new lap: the sting, the lap\'s song, the lap line', () => {
    const r = quiet();
    const car = r.runner.carOf(0)!;
    car.lap = 2;
    const n = r.trace.length;
    r.audio.log.length = 0;
    r.idle('race', 400);
    expect(r.audio.log.slice(0, 2)).toEqual(['music:rally-jingle-3:once', 'music:rally-lap2:once']);
    expect(r.said(n)).toEqual(['rally/dj/lap/1']);
    car.lap = 3;
    r.idle('race', 400);
    expect(r.said(n)[1]).toMatch(/^rally\/dj\/lap\/[23]$/);
  });
});

describe('FILE FM: the events to the lines', () => {
  const cases: [string, (r: Rig) => void, RegExp][] = [
    ['a camera flashes a player', (r) => r.runner.events.emit('flash', { car: 'white', slot: 0, speed: 140, limit: 100, where: 'x', kind: 'camera' }), /^rally\/dj\/flash\/\d$/],
    ['the average-speed zone flashes a player', (r) => r.runner.events.emit('flash', { car: 'white', slot: 0, speed: 120, limit: 100, where: 'x', kind: 'zone' }), /^rally\/dj\/zone\/1$/],
    ['a red X', (r) => r.runner.events.emit('redx', { car: 'white', slot: 0, gantry: 1, lane: 0 }), /^rally\/dj\/redx\/\d$/],
    ['road works', (r) => r.runner.events.emit('roadworksAhead', { section: 'noord', lanes: [0] }), /^rally\/dj\/roadworks\/\d$/],
    ['the spitsstrook', (r) => r.runner.events.emit('spitsstrookOpen', { lap: 3 }), /^rally\/dj\/spitsstrook\/1$/],
    ['a jam', (r) => r.runner.events.emit('jam', { section: 'oost' }), /^rally\/dj\/jam\/\d$/],
    ['the police join', (r) => r.runner.events.emit('policeActive', { count: 1 }), /^rally\/dj\/police\/1$/],
    ['a pull-over', (r) => r.runner.events.emit('pulledOver', { car: 'x', slot: -1, police: 'p' }), /^rally\/dj\/pulledOver\/\d$/],
    ['a player wins', (r) => r.runner.events.emit('finish', { car: 'white', slot: 0, place: 1, ticks: 9, projected: false }), /^rally\/dj\/finish\/2$/],
    ['a rival wins', (r) => r.runner.events.emit('finish', { car: 'x', slot: -1, place: 1, ticks: 9, projected: false }), /^rally\/dj\/finish\/1$/],
  ];
  it.each(cases)('%s', (_name, emit, line) => {
    const r = quiet();
    const n = r.trace.length;
    emit(r);
    r.idle('race', 300);
    const said = r.said(n);
    expect(said.length, said.join(',')).toBe(1);
    expect(said[0]).toMatch(line);
  });

  it('the rivals\' zone flashes make the news only sometimes (the AI filter, as the cameras\')', () => {
    // Fixer (wave C review): before, every AI zone flash asked for the line (it played every lap).
    const r = quiet();
    const N = 24;
    let on = 0;
    for (let i = 0; i < N; i++) {
      const n = r.trace.length;
      r.runner.events.emit('flash', { car: 'x', slot: -1, speed: 120, limit: 100, where: 'x', kind: 'zone' });
      r.idle('race', 3700); // past the zone line's cooldown and gap (60 s)
      if (r.said(n).some((id) => id.startsWith('rally/dj/zone/'))) on++;
    }
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(N / 2);
  });

  it('the police: their arrival once; the release only after a pull-over was on air', () => {
    const r = quiet();
    const n = r.trace.length;
    r.runner.events.emit('released', { car: 'x', slot: -1 });
    r.idle('race', 300);
    expect(r.said(n)).toEqual([]);
    r.runner.events.emit('policeActive', { count: 1 });
    r.idle('race', 3000);
    r.runner.events.emit('policeActive', { count: 2 });
    r.runner.events.emit('pulledOver', { car: 'x', slot: -1, police: 'p' });
    r.idle('race', 200);
    r.runner.events.emit('released', { car: 'x', slot: -1 });
    r.idle('race', 600);
    expect(r.said(n).map((id) => id.replace(/\/\d$/, ''))).toEqual(['rally/dj/police', 'rally/dj/pulledOver', 'rally/dj/released']);
  });

  it('a long quiet: the DJ fills in with a station id or a filler line', () => {
    const r = quiet();
    const n = r.trace.length;
    r.idle('race', 3200);
    expect(r.said(n).length).toBe(1);
    expect(r.said(n)[0]).toMatch(/^rally\/dj\/(station|filler)\/\d$/);
  });

  it('the results without a player\'s win: the waiting list line', () => {
    const r = quiet();
    const n = r.trace.length;
    r.idle('finish', 300);
    expect(r.said(n)).toEqual(['rally/dj/finish/3']);
    const w = quiet();
    w.runner.events.emit('finish', { car: 'white', slot: 0, place: 1, ticks: 9, projected: false });
    const m = w.trace.length;
    w.idle('finish', 600);
    expect(w.said(m).filter((id) => id === 'rally/dj/finish/3')).toEqual([]);
  });
});

describe('FILE FM: the tunnels', () => {
  it('the line just before the portal; the static in the tunnel cuts it; the reception back at the exit', () => {
    const base = ringTrack();
    const track = { ...base, tunnels: [{ name: 'COENTUNNEL', s0: 2000, s1: 2240 }] } as RallyTrack;
    const r = quiet({ track });
    const car = r.runner.carOf(0)!;
    car.s = 2000 - 60;
    car.speed = 40;
    const n = r.trace.length;
    r.idle('race', 30);
    expect(r.said(n)).toEqual(['rally/dj/tunnel/1']);
    r.runner.events.emit('tunnelIn', { car: car.id, slot: 0, name: 'COENTUNNEL' });
    r.idle('race', 2);
    expect(r.trace.some((l) => /CUT\s+rally\/dj\/tunnel\/1.*\(signal\)/.test(l))).toBe(true);
    const inside = r.audio.radio[r.audio.radio.length - 1]!;
    expect(inside.muffle).toBeGreaterThan(0.5);
    expect(inside.signal).toBeLessThan(0.2);
    expect(inside.static).toBeGreaterThan(0.5);
    expect(r.radio.ticker).toBe(TICKER_NO_SIGNAL);
    // Nothing is said in the tunnel.
    r.runner.events.emit('jam', { section: 'noord' });
    r.idle('race', 100);
    expect(r.said(n)).toEqual(['rally/dj/tunnel/1']);
    r.runner.events.emit('tunnelOut', { car: car.id, slot: 0, name: 'COENTUNNEL' });
    r.idle('race', 2);
    const out = r.audio.radio[r.audio.radio.length - 1]!;
    expect(out.static ?? 0).toBe(0);
    expect(out.muffle ?? 0).toBe(0);
    expect(r.radio.ticker.startsWith(RADIO_STATION)).toBe(true);
  });

  it('2P: one radio; half static with one player inside, the full static with both', () => {
    const r = quiet({ players: 2 });
    r.runner.events.emit('tunnelIn', { car: 'white', slot: 0, name: 'COENTUNNEL' });
    r.idle('race', 1);
    const half = r.audio.radio[r.audio.radio.length - 1]!;
    expect(half.static).toBeGreaterThan(0);
    expect(half.signal).toBeGreaterThan(0.3);
    expect(r.radio.ticker).not.toBe(TICKER_NO_SIGNAL);
    r.runner.events.emit('tunnelIn', { car: 'green', slot: 1, name: 'COENTUNNEL' });
    r.idle('race', 1);
    expect(r.audio.radio[r.audio.radio.length - 1]!.signal).toBeLessThan(0.2);
    expect(r.radio.ticker).toBe(TICKER_NO_SIGNAL);
  });
});

describe('FILE FM: the output, the ticker and the settings', () => {
  it('the ticker: FILE FM and the song title; the DJ\'s line while it plays (and a moment after)', () => {
    const r = rig();
    r.idle('intro', 1);
    // The opening sting shows the station's slogan; the lap's song its title.
    expect(r.radio.ticker).toBe(JINGLE_TEXT);
    r.idle('intro', 20);
    expect(r.radio.ticker).toBe(tickerText('Goedemiddag Amsterdam! Vandaag op de A10: de Ringrally!'));
    r.idle('intro', 1500);
    expect(r.radio.ticker).toBe('FILE FM  RONDJE RING');
  });

  it('a take: say() on the voice bus as the DJ (important); the line lasts while it speaks', () => {
    const r = rig();
    const text = 'Drie... twee... één... GAAN!';
    r.audio.takes.add(text);
    r.audio.speakingNow = true;
    r.idle('grid', 1);
    expect(r.audio.log).toContain(`say:${DJ_SPEAKER}:!${text}`);
    r.idle('grid', 300);
    expect(r.radio.sched.onAir?.text).toBe(text);
    r.audio.speakingNow = false;
    r.idle('grid', 10);
    expect(r.radio.sched.onAir).toBeNull();
  });

  it('the music volume at 0 switches the radio off: no DJ, no ticker', () => {
    let on = false;
    const r = rig({ on: () => on });
    r.audio.takes.add('Drie... twee... één... GAAN!');
    r.idle('grid', 5);
    expect(r.audio.log.filter((l) => l.startsWith('say:'))).toEqual([]);
    expect(r.radio.ticker).toBe('');
    on = true;
    r.idle('grid', 1);
    expect(r.radio.ticker).not.toBe('');
  });

  it('with the output\'s clock the next item follows the song-end event', () => {
    const r = rig();
    r.audio.clock = { id: 'rally-lap1', source: 'synth', position: 0, duration: 150, ended: false, paused: false };
    r.idle('race', 20000);
    expect(r.audio.log.filter((l) => l.startsWith('music:'))).toEqual(['music:rally-lap1:once']);
    r.audio.endFn?.('rally-lap1');
    r.idle('race', 2);
    expect(r.audio.log.filter((l) => l.startsWith('music:'))).toEqual(['music:rally-lap1:once', 'music:rally-jingle-1:once']);
    r.audio.endFn?.('rally-jingle-1');
    r.idle('race', 2);
    expect(r.audio.log[r.audio.log.length - 1]).toBe('music:rally-lap1:once');
  });

  it('dispose: the radio neutral, the music off, no more listening', () => {
    const r = quiet();
    r.radio.dispose();
    expect(r.audio.radio[r.audio.radio.length - 1]).toBeNull();
    expect(r.audio.log[r.audio.log.length - 1]).toBe('music:null');
    expect(r.audio.endFn).toBeNull();
    const n = r.trace.length;
    r.runner.events.emit('jam', { section: 'x' });
    expect(r.trace.length).toBe(n);
    expect(r.radio.ticker).toBe('');
  });
});

describe('FILE FM never changes the race', () => {
  it('the same seed with and without the radio: the same stateHash, report and rng', () => {
    const play = (withRadio: boolean): string => {
      const h = race({ track: ringTrack(), seed: 7 });
      const radio = withRadio ? new RallyRadio({ audio: new FakeAudio(), runner: h.runner }) : null;
      for (let i = 0; i < 2400; i++) {
        radio?.step(h.runner.phase);
        h.step(1);
      }
      radio?.dispose();
      const rep = h.runner.report();
      return JSON.stringify([rep, h.runner.rng.getState(), h.runner.fxRng.getState()]);
    };
    expect(play(true)).toBe(play(false));
  });
});
