/**
 * The race's sound (SFX, wave C; src/game/rally/sound.ts, content/sfx/rally-car.ts and
 * rally-world.ts; docs/api/rally.md "C.S"):
 * - every id the module plays has a recipe (the team horns = the team specs' `horn`), the loops loop,
 *   every team has its own engine voice;
 * - the pure helpers: the rpm mapping (idle, revving on the grid, the drop at an upshift, the belt
 *   drive), the distance gain, the horn of a body;
 * - the cues fire on the right events (a recording AudioOut on a real race on the A10): the
 *   countdown, the flash, the pull-over, the horns, bumps, scrapes, the crash, the recovery, the
 *   finish; the engines (at most four voices, both estates in 2P, rivals near a player), the siren
 *   with its doppler, the ice-cream tune, the arrow truck, the whoosh, the tunnel echo, the DJ duck,
 *   the pause and the detach;
 * - nothing changes the race: the state hash and both rngs are the same with and without it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AudioOut, EchoOpts, EngineOpts, SfxOpts } from '../../../src/engine/audio';
import { ENGINE_VOICES, hasSfx } from '../../../src/engine/audio';
import { InputManager } from '../../../src/engine/input';
import { sfxIsLoop } from '../../../src/engine/synth';
import { loadContent } from '../../../src/game/content/index';
import { TEAMS } from '../../../src/game/content/rally/teams/index';
import type { CarState, RallyBody } from '../../../src/game/rally/api';
import { BODY_LIGHT } from '../../../src/game/rally/ids';
import { COUNTDOWN_TICKS, RallyRunner } from '../../../src/game/rally/runner';
import {
  attachRallySound,
  CAR_ENGINES,
  distanceGain,
  engineRpm,
  engineVoiceOf,
  ESTATE_ENGINE,
  hornOf,
  IDLE_RPM,
  MIX,
  RALLY_SOUND_IDS,
  RALLY_TUNNEL_ECHO,
  REDLINE_RPM,
  type RallySound,
} from '../../../src/game/rally/sound';
import { loadRallyContent } from '../../../src/game/scenes/rally-route';
import { GameSession } from '../../../src/game/session';

await loadContent();
await loadRallyContent();

// ------------------------------------------------------------------------------------------ helpers

interface Played {
  id: string;
  vol: number;
  pan: number;
  pitch: number;
}

/** An AudioOut that records what the sound module asks for. */
class RecAudio implements AudioOut {
  readonly played: Played[] = [];
  readonly loops = new Map<string, Played>();
  readonly engines = new Map<string, EngineOpts>();
  maxEngines = 0;
  echo: EchoOpts | null = null;
  echoCalls = 0;
  talking = false;
  paused = 0;
  sfx(id: string, o?: SfxOpts): void {
    this.played.push({ id, vol: o?.vol ?? 1, pan: o?.pan ?? 0, pitch: o?.pitch ?? 1 });
  }
  music(): void {}
  voice(): void {}
  setVolume(): void {}
  stopAll(): void {}
  sfxLoop(key: string, id: string, o?: SfxOpts): void {
    this.loops.set(key, { id, vol: o?.vol ?? 1, pan: o?.pan ?? 0, pitch: o?.pitch ?? 1 });
  }
  stopSfx(key: string): void {
    this.loops.delete(key);
  }
  engine(key: string, o: EngineOpts): void {
    this.engines.set(key, { ...o });
    this.maxEngines = Math.max(this.maxEngines, this.engines.size);
  }
  stopEngine(key: string): void {
    this.engines.delete(key);
  }
  setEcho(o: EchoOpts | null): void {
    this.echo = o;
    this.echoCalls++;
  }
  speaking(): boolean {
    return this.talking;
  }
  pauseLoops(): void {
    this.paused++;
  }
  resumeLoops(): void {
    this.paused--;
  }
  ids(): string[] {
    return this.played.map((p) => p.id);
  }
  last(id: string): Played | undefined {
    for (let i = this.played.length - 1; i >= 0; i--) if (this.played[i].id === id) return this.played[i];
    return undefined;
  }
}

interface Race {
  runner: RallyRunner;
  audio: RecAudio;
  sound: RallySound | null;
  step(n?: number): void;
}

const attached: RallySound[] = [];
afterEach(() => {
  for (const s of attached.splice(0)) s.detach();
});

function race(o: { players?: 1 | 2; seed?: number; lap?: 1 | 2 | 3; sound?: boolean; cues?: boolean; auto?: boolean } = {}): Race {
  const players = o.players ?? 1;
  const input = new InputManager();
  input.players = players;
  input.raceMode = true;
  const session = new GameSession({ characters: players === 2 ? ['recruit', 'vincent'] : ['recruit'], seed: o.seed ?? 1, difficulty: 'normal' });
  const runner = new RallyRunner({ seed: o.seed ?? 1, difficulty: 'normal', players, session, pads: [input.pad(0), input.pad(1)], lap: o.lap });
  const audio = new RecAudio();
  const sound = o.sound === false ? null : attachRallySound(runner, audio, { cues: o.cues });
  if (sound) attached.push(sound);
  runner.start();
  if (o.auto !== false) for (let s = 0; s < players; s++) runner.setAutopilot(s, true);
  return {
    runner,
    audio,
    sound,
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        input.update();
        runner.step();
        sound?.tick();
      }
    },
  };
}

/** Put a body `ahead` m in front of car `c` and `right` m to its right, heading like it at `speed`. */
function place(b: RallyBody, c: CarState, ahead: number, right: number, speed = c.speed, yaw = c.yaw): void {
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  (b.pos as number[])[0] = c.pos[0] + fx * ahead - fz * right;
  (b.pos as number[])[1] = c.pos[1];
  (b.pos as number[])[2] = c.pos[2] + fz * ahead + fx * right;
  b.yaw = yaw;
  b.speed = speed;
}

// ------------------------------------------------------------------------------------------ recipes

describe('the recipes', () => {
  it('every id the module plays has a recipe; each team horn is its spec’s `horn`', () => {
    expect(RALLY_SOUND_IDS.filter((id) => !hasSfx(id))).toEqual([]);
    for (const t of TEAMS) {
      expect(t.spec.horn, t.spec.id).toBe(`rally/horn/${t.spec.id}`);
      expect(hasSfx(t.spec.horn as string), t.spec.horn).toBe(true);
    }
  });

  it('the beds are loops; the one-shots are not', () => {
    for (const id of ['rally/squeal', 'rally/scrape', 'rally/wind', 'rally/siren', 'rally/arrow-beep', 'rally/ijsco-tune', 'ring/tunnel-bed']) expect(sfxIsLoop(id), id).toBe(true);
    for (const id of ['rally/bump', 'rally/flitser', 'rally/finish', 'rally/whoosh', 'rally/horn/car']) expect(sfxIsLoop(id), id).toBe(false);
  });

  it('every team and both estates have their own engine voice (the hearse deep, OMA TRUUS high)', () => {
    for (const t of TEAMS) expect(CAR_ENGINES[t.spec.id], t.spec.id).toBeDefined();
    expect(engineVoiceOf('white')).toBe(ESTATE_ENGINE);
    expect(engineVoiceOf('green')).toBe(ESTATE_ENGINE);
    expect(ESTATE_ENGINE.cyl).toBe(5);
    expect(ESTATE_ENGINE.turbo).toBeGreaterThan(0);
    const fire = (id: string): number => {
      const v = engineVoiceOf(id);
      return (engineRpm(0.6, 30, 1, v) / 60) * (v.cyl / 2) * v.pitch;
    };
    expect(fire('laatste-rit')).toBeLessThan(fire('white'));
    expect(fire('oma-truus')).toBeGreaterThan(fire('white'));
    const voices = new Set(TEAMS.map((t) => JSON.stringify(CAR_ENGINES[t.spec.id])));
    expect(voices.size).toBe(TEAMS.length);
  });
});

// ------------------------------------------------------------------------------------------ helpers

describe('the pure helpers', () => {
  it('engineRpm: the idle, revving on the grid, the range, the drop at an upshift, the belt drive', () => {
    expect(engineRpm(0.25, 0, 0)).toBe(IDLE_RPM);
    expect(engineRpm(0.35, 0, 1)).toBeGreaterThan(3500);
    expect(engineRpm(1, 40, 1)).toBeCloseTo(REDLINE_RPM, 5);
    // DRIVE's rev at the top of 2nd (24 m/s) and at the bottom of 3rd.
    expect(engineRpm(0.35, 24.5, 1)).toBeLessThan(engineRpm(1, 23.9, 1) * 0.6);
    const cvt = engineVoiceOf('achteruit');
    expect(cvt.cvt).toBe(true);
    expect(engineRpm(0.25, 30, 1, cvt)).toBeGreaterThan(engineRpm(1, 10, 1, cvt));
    expect(engineRpm(1, 40, 1, engineVoiceOf('oma-truus'))).toBeGreaterThan(REDLINE_RPM);
  });

  it('distanceGain: 1 near, −6 dB per doubling, silent at the range', () => {
    expect(distanceGain(3, 8, 100)).toBe(1);
    expect(distanceGain(16, 8, 100)).toBeCloseTo(0.5, 6);
    expect(distanceGain(32, 8, 100)).toBeCloseTo(0.25, 6);
    expect(distanceGain(99, 8, 100)).toBeLessThan(0.01);
    expect(distanceGain(100, 8, 100)).toBe(0);
    expect(distanceGain(Number.NaN, 8, 100)).toBe(0);
  });

  it('hornOf: a rival’s team horn, an air horn for a lorry or a coach, a car horn else (stable)', () => {
    const r = race({ sound: false });
    const hearse = r.runner.cars.find((c) => c.id === 'laatste-rit') as CarState;
    expect(hornOf(hearse)).toBe('rally/horn/laatste-rit');
    const lorry = r.runner.bodies.find((b) => b.id.startsWith('lorry')) as RallyBody;
    expect(hornOf(lorry)).toBe('rally/horn/air');
    const hatch = r.runner.bodies.find((b) => b.id.startsWith('hatch')) as RallyBody;
    expect(['rally/horn/car', 'rally/horn/car-long']).toContain(hornOf(hatch));
    expect(hornOf(hatch)).toBe(hornOf(hatch));
  });
});

// ------------------------------------------------------------------------------------------ the race

describe('the cues on a race', () => {
  it('the countdown beeps three times, then GO once (none during a wait without race steps)', () => {
    const r = race({ auto: false });
    for (let i = 0; i < 20; i++) r.sound?.tick();
    expect(r.audio.ids().filter((id) => id === 'rally/count')).toHaveLength(0);
    r.step(COUNTDOWN_TICKS + 2);
    const ids = r.audio.ids();
    expect(ids.filter((id) => id === 'rally/count')).toHaveLength(3);
    expect(ids.filter((id) => id === 'rally/go')).toHaveLength(1);
    expect(ids.lastIndexOf('rally/count')).toBeLessThan(ids.indexOf('rally/go'));
  });

  it('cues off: no countdown, no GO, no player flash, no pull-over (the scene keeps its own)', () => {
    const r = race({ cues: false, auto: false });
    r.step(COUNTDOWN_TICKS + 2);
    r.runner.events.emit('flash', { car: 'white', slot: 0, speed: 140, limit: 100, where: 'x', kind: 'camera' });
    r.runner.events.emit('pulledOver', { car: 'white', slot: 0, police: 'police-1' });
    expect(r.audio.ids().filter((id) => ['rally/count', 'rally/go', 'rally/flitser', 'rally/whoop'].includes(id))).toEqual([]);
  });

  it('the events: flash, pull-over, horns, bumps, scrapes, crash, recovery, finish', () => {
    const r = race();
    r.step(COUNTDOWN_TICKS + 30);
    const ev = r.runner.events;
    const me = r.runner.carOf(0) as CarState;
    const hearse = r.runner.cars.find((c) => c.id === 'laatste-rit') as CarState;
    place(hearse, me, 15, 3);
    const n0 = r.audio.played.length;
    ev.emit('flash', { car: 'white', slot: 0, speed: 140, limit: 100, where: 'x', kind: 'camera' });
    expect(r.audio.last('rally/flitser')?.vol).toBe(MIX.flash);
    // A rival flashed near the player: the same click, quieter and panned.
    ev.emit('flash', { car: 'laatste-rit', slot: -1, speed: 140, limit: 100, where: 'x', kind: 'camera' });
    const far = r.audio.last('rally/flitser') as Played;
    expect(far.vol).toBeLessThan(MIX.flash);
    expect(far.vol).toBeGreaterThan(0);
    ev.emit('pulledOver', { car: 'white', slot: 0, police: 'police-1' });
    expect(r.audio.last('rally/whoop')).toBeDefined();
    ev.emit('honk', { car: 'laatste-rit', slot: 0 });
    const horn = r.audio.last('rally/horn/laatste-rit') as Played;
    expect(horn.vol).toBeGreaterThan(0.3);
    expect(horn.pan).toBeGreaterThan(0); // the hearse is on the right
    const lorry = r.runner.bodies.find((b) => b.id.startsWith('lorry')) as RallyBody;
    place(lorry, me, -20, -4);
    ev.emit('honk', { car: lorry.id, slot: 0 });
    expect((r.audio.last('rally/horn/air') as Played).pan).toBeLessThan(0);
    ev.emit('bump', { a: 'white', b: 'laatste-rit', slotA: 0, slotB: -1, dv: 3 });
    expect(r.audio.last('rally/bump')).toBeDefined();
    ev.emit('bump', { a: 'laatste-rit', b: 'white', slotA: -1, slotB: 0, dv: 9 });
    expect(r.audio.last('rally/bump-hard')?.vol).toBeCloseTo(MIX.bump, 5);
    ev.emit('scrape', { car: 'white', slot: 0, side: -1, speed: 30 });
    expect((r.audio.last('rally/scrape-hit') as Played).pan).toBeLessThan(0);
    ev.emit('crash', { car: 'white', slot: 0, other: lorry.id });
    expect(r.audio.last('rally/crash')?.vol).toBe(1);
    ev.emit('recover', { car: 'white', slot: 0 });
    expect(r.audio.last('rally/recover')).toBeDefined();
    ev.emit('recover', { car: 'laatste-rit', slot: -1 });
    ev.emit('finish', { car: 'white', slot: 0, place: 3, ticks: 9000, projected: false });
    ev.emit('finish', { car: 'white', slot: 0, place: 1, ticks: 9000, projected: false });
    ev.emit('finish', { car: 'white', slot: 0, place: 1, ticks: 9000, projected: true });
    ev.emit('finish', { car: 'laatste-rit', slot: -1, place: 1, ticks: 9000, projected: false });
    const after = r.audio.ids().slice(n0);
    expect(after.filter((id) => id === 'rally/recover')).toHaveLength(1);
    expect(after.filter((id) => id === 'rally/finish')).toHaveLength(1);
    expect(after.filter((id) => id === 'rally/finish-win')).toHaveLength(1);
    // A rival's honk far away is silent.
    const n1 = r.audio.played.length;
    place(hearse, me, 400, 0);
    ev.emit('honk', { car: 'laatste-rit', slot: 0 });
    expect(r.audio.played.length).toBe(n1);
  });

  it('engines: the player’s estate from DRIVE’s revs, the nearest rivals, never more than four voices, a shift', () => {
    const r = race();
    r.step(30);
    const idle = r.audio.engines.get('rally/eng/white') as EngineOpts;
    expect(idle).toBeDefined();
    expect(idle.rpm).toBeLessThan(1000);
    expect(idle.cyl).toBe(5);
    expect(idle.turbo).toBe(ESTATE_ENGINE.turbo);
    // The grid: rivals stand all round the player.
    expect(r.audio.engines.size).toBe(ENGINE_VOICES);
    let maxRpm = 0;
    let rivals = new Set<string>();
    for (let i = 0; i < 1200; i++) {
      r.step();
      const e = r.audio.engines.get('rally/eng/white') as EngineOpts;
      maxRpm = Math.max(maxRpm, e.rpm);
      for (const k of r.audio.engines.keys()) if (k !== 'rally/eng/white') rivals.add(k);
    }
    expect(r.audio.maxEngines).toBeLessThanOrEqual(ENGINE_VOICES);
    expect(maxRpm).toBeGreaterThan(5000);
    expect(maxRpm).toBeLessThanOrEqual(REDLINE_RPM + 1);
    expect(rivals.size).toBeGreaterThan(1);
    expect(r.audio.ids()).toContain('rally/shift');
    // A rival's voice has its own pitch, a distance level and a pan.
    const [rk, ro] = [...r.audio.engines.entries()].find(([k]) => k !== 'rally/eng/white') as [string, EngineOpts];
    const id = rk.slice('rally/eng/'.length);
    expect(ro.cyl).toBe(engineVoiceOf(id).cyl);
    expect(ro.vol).toBeLessThanOrEqual(MIX.rival * MIX.tunnel + 1e-9);
    rivals = new Set();
  });

  it('2P: both estates in the mix (panned apart), at most four voices', () => {
    const r = race({ players: 2 });
    r.step(COUNTDOWN_TICKS + 900);
    const w = r.audio.engines.get('rally/eng/white') as EngineOpts;
    const g = r.audio.engines.get('rally/eng/green') as EngineOpts;
    expect(w).toBeDefined();
    expect(g).toBeDefined();
    expect(w.pan).toBeLessThan(0);
    expect(g.pan).toBeGreaterThan(0);
    expect(w.vol).toBeLessThanOrEqual(MIX.player2p * MIX.tunnel + 1e-9);
    expect(r.audio.maxEngines).toBeLessThanOrEqual(ENGINE_VOICES);
    expect(r.audio.loops.has('rally/wind/p0') || r.audio.loops.has('rally/wind/p1')).toBe(true);
  });

  it('the wind rises with speed; the DJ ducks the engines and the wind', () => {
    const r = race();
    r.step(COUNTDOWN_TICKS + 900);
    const me = r.runner.carOf(0) as CarState;
    expect(me.speed).toBeGreaterThan(30);
    const wind = r.audio.loops.get('rally/wind/p0') as Played;
    expect(wind.vol).toBeGreaterThan(0.05);
    const before = (r.audio.engines.get('rally/eng/white') as EngineOpts).vol as number;
    r.audio.talking = true;
    for (let i = 0; i < 60; i++) r.sound?.tick();
    expect(r.sound?.state.duck).toBeCloseTo(MIX.djDuck, 2);
    const during = (r.audio.engines.get('rally/eng/white') as EngineOpts).vol as number;
    expect(during / before).toBeCloseTo(MIX.djDuck, 1);
    r.audio.talking = false;
    for (let i = 0; i < 60; i++) r.sound?.tick();
    expect(r.sound?.state.duck).toBeGreaterThan(0.99);
  });

  it('the siren: a police car with its blue lights on sounds, higher while it closes in, silent when they go off', () => {
    const r = race();
    r.step(COUNTDOWN_TICKS + 300);
    const me = r.runner.carOf(0) as CarState;
    const cop = r.runner.bodies.find((b) => b.kind === 'police') as RallyBody;
    const key = `rally/siren/${cop.id}`;
    cop.hidden = false;
    cop.lights = BODY_LIGHT.blue;
    // Behind the player and faster: closing in.
    for (let i = 0; i < 20; i++) {
      place(cop, me, -60 + i, 3, me.speed + 25);
      r.sound?.tick();
    }
    const near = r.audio.loops.get(key) as Played;
    expect(near.id).toBe('rally/siren');
    expect(near.pitch).toBeGreaterThan(1.02);
    // Past the player and away.
    for (let i = 0; i < 30; i++) {
      place(cop, me, 20 + i, 3, me.speed + 25);
      r.sound?.tick();
    }
    expect((r.audio.loops.get(key) as Played).pitch).toBeLessThan(0.98);
    cop.lights = 0;
    r.sound?.tick();
    expect(r.audio.loops.has(key)).toBe(false);
    cop.hidden = true;
  });

  it('DE IJSCOMAN’s tune near the player; the arrow truck’s beeps near the works', () => {
    const r = race();
    r.step(COUNTDOWN_TICKS + 60);
    const me = r.runner.carOf(0) as CarState;
    const van = r.runner.cars.find((c) => c.id === 'ijscoman') as CarState;
    place(van, me, 12, 3);
    r.sound?.tick();
    expect(r.audio.loops.get('rally/ijsco')?.id).toBe('rally/ijsco-tune');
    place(van, me, 500, 3);
    r.sound?.tick();
    expect(r.audio.loops.has('rally/ijsco')).toBe(false);
    const truck = r.runner.bodies.find((b) => b.id.startsWith('rw-truck')) as RallyBody;
    expect(truck).toBeDefined();
    truck.hidden = false;
    place(truck, me, 40, -4, 0);
    r.sound?.tick();
    const beep = r.audio.loops.get(`rally/arrow/${truck.id}`) as Played;
    expect(beep.id).toBe('rally/arrow-beep');
    expect(beep.pan).toBeLessThan(0);
    truck.hidden = true;
    r.sound?.tick();
    expect(r.audio.loops.has(`rally/arrow/${truck.id}`)).toBe(false);
  });

  it('the whoosh: a car crossing the player’s nose close and fast (a lorry: the big one)', () => {
    const r = race();
    r.step(COUNTDOWN_TICKS + 600);
    const me = r.runner.carOf(0) as CarState;
    const hatch = r.runner.bodies.find((b) => b.kind === 'traffic' && b.id.startsWith('hatch')) as RallyBody;
    const lorry = r.runner.bodies.find((b) => b.kind === 'traffic' && b.id.startsWith('lorry')) as RallyBody;
    const wasH = hatch.hidden;
    const wasL = lorry.hidden;
    hatch.hidden = false;
    lorry.hidden = false;
    // The player passes them: slower traffic goes from ahead to behind.
    for (let a = 6; a >= -6; a -= 2) {
      place(hatch, me, a, 3.5, me.speed - 20);
      place(lorry, me, a + 0.5, -3.5, me.speed - 20);
      r.sound?.tick();
    }
    expect(r.audio.ids()).toContain('rally/whoosh');
    const big = r.audio.last('rally/whoosh-big') as Played;
    expect(big).toBeDefined();
    expect(big.pan).toBeLessThan(0);
    expect((r.audio.last('rally/whoosh') as Played).pan).toBeGreaterThan(0);
    hatch.hidden = wasH;
    lorry.hidden = wasL;
  });

  it('the tunnels: the echo and the bed while a player is inside, off at the exit', () => {
    const r = race();
    r.step(COUNTDOWN_TICKS + 30);
    const me = r.runner.carOf(0) as CarState;
    const tunnels = (r.runner.track as unknown as { tunnels: readonly { s0: number; s1: number }[] }).tunnels;
    expect(tunnels.length).toBe(2);
    const s = me.s;
    me.s = (tunnels[0].s0 + tunnels[0].s1) / 2;
    r.sound?.tick();
    expect(r.audio.echo).toEqual(RALLY_TUNNEL_ECHO);
    expect(r.audio.loops.has('rally/tunnel')).toBe(true);
    me.s = tunnels[0].s1 + 50;
    r.sound?.tick();
    expect(r.audio.echo).toBeNull();
    expect(r.audio.loops.has('rally/tunnel')).toBe(false);
    me.s = s;
  });

  it('the tyres: a slide squeals, the handbrake ratchets, the barrier grinds', () => {
    const r = race({ auto: false });
    r.step(COUNTDOWN_TICKS + 2);
    const me = r.runner.carOf(0) as CarState;
    me.speed = 30;
    me.phys.slip = 5;
    r.sound?.tick();
    const sq = r.audio.loops.get('rally/sq/white') as Played;
    expect(sq.id).toBe('rally/squeal');
    expect(sq.vol).toBeGreaterThan(0.4);
    me.phys.slip = 0;
    me.phys.scrape = 3;
    me.phys.scrapeSide = 1;
    r.sound?.tick();
    expect(r.audio.loops.has('rally/sq/white')).toBe(false);
    expect((r.audio.loops.get('rally/scr/white') as Played).pan).toBeGreaterThan(0);
    me.phys.scrape = 0;
    r.sound?.tick();
    expect(r.audio.loops.has('rally/scr/white')).toBe(false);
    const inp = r.runner.inputs[r.runner.cars.indexOf(me)];
    inp.handbrake = true;
    r.sound?.tick();
    r.sound?.tick();
    expect(r.audio.ids().filter((id) => id === 'rally/handbrake')).toHaveLength(1);
    inp.handbrake = false;
  });

  it('pause silences the loops; detach stops every sound and listener', () => {
    const r = race();
    r.step(COUNTDOWN_TICKS + 600);
    expect(r.audio.engines.size).toBeGreaterThan(0);
    r.sound?.pause();
    r.sound?.pause();
    expect(r.audio.paused).toBe(1);
    r.sound?.resume();
    expect(r.audio.paused).toBe(0);
    const me = r.runner.carOf(0) as CarState;
    const s = me.s;
    const tunnels = (r.runner.track as unknown as { tunnels: readonly { s0: number; s1: number }[] }).tunnels;
    me.s = (tunnels[1].s0 + tunnels[1].s1) / 2;
    r.sound?.tick();
    expect(r.audio.echo).not.toBeNull();
    me.s = s;
    r.sound?.detach();
    r.sound?.detach();
    expect(r.audio.engines.size).toBe(0);
    expect(r.audio.loops.size).toBe(0);
    expect(r.audio.echo).toBeNull();
    const n = r.audio.played.length;
    r.runner.events.emit('flash', { car: 'white', slot: 0, speed: 140, limit: 100, where: 'x', kind: 'camera' });
    r.sound?.tick();
    expect(r.audio.played.length).toBe(n);
  });
});

// ------------------------------------------------------------------------------------------ identity

describe('the sound never changes the race', () => {
  it.each([1, 2] as const)('%iP: the state hash and both rngs are the same with and without it', (players) => {
    const a = race({ players, seed: 3 });
    const b = race({ players, seed: 3, sound: false });
    for (let i = 0; i < COUNTDOWN_TICKS + 1500; i++) {
      a.step();
      b.step();
    }
    expect(a.runner.stateHash()).toBe(b.runner.stateHash());
    expect(a.runner.rng.getState()).toEqual(b.runner.rng.getState());
    expect(a.runner.fxRng.getState()).toEqual(b.runner.fxRng.getState());
    expect(a.audio.played.length).toBeGreaterThan(0);
  });
});
