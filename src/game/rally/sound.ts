/**
 * The race's sound (SFX, wave C; docs/design/rally.md §8 "Synth", §12.6; docs/api/rally.md "C.S"):
 * a cosmetic listener on a RallyRunner that turns the race into synth sound through the `AudioOut`
 * opt-ins. Our own recipes (content/sfx/rally-car.ts, rally-world.ts); no samples.
 *
 * - **Engines** (`AudioOut.engine`, at most ENGINE_VOICES): each player's estate (a five-cylinder
 *   with a turbo whine; rpm from DRIVE's `phys.rev` and `gear`, a lift and the blow-off at an
 *   upshift, revving on the grid) and the rivals nearest a player (each team its own cylinders,
 *   pitch and roughness: the hearse deep and smooth, OMA TRUUS high and buzzy, ACHTERUIT's belt
 *   drive one droning note), with distance, stereo pan and doppler. 2P: both estates in the mix.
 * - **Tyres and hits:** the squeal from the slip, the handbrake and hard braking (`rally/squeal`
 *   per car), the handbrake's ratchet, the barrier (`rally/scrape-hit`, then `rally/scrape` while
 *   it touches), bumps (`rally/bump`, `rally/bump-hard`), a crash into traffic, the recovery blink.
 * - **The world:** the horns (`honk`: a rival's team horn = its spec's `horn`, traffic by size), the
 *   police two-tone (`rally/siren` while a police car's blue lights are on, doppler as it passes),
 *   the speed camera (`rally/flitser`: full for a player, quieter for a rival near one), the wind
 *   above about 80 km/h, the passing whoosh of traffic (a car / a lorry or coach crossing a player
 *   close at speed), the arrow-board truck's beeps at the road works, DE IJSCOMAN's tune when it
 *   is near, the tunnels (the sfx echo `setEcho` and the tunnel bed while a player is inside), the
 *   finish sting. With `cues` (default on) also the countdown beeps, the GO and the pull-over.
 * - **The mix:** the radio is the music and voice buses (RADIO); the engines and the wind duck by
 *   `DJ_DUCK` while a voice speaks (`speaking()`), so they never mask the DJ. Levels: MIX.
 *
 * Cosmetic only: it reads the runner (cars, bodies, inputs, track) and listens to `runner.events`;
 * it never writes race state and never draws from `runner.rng` (picks use a hash of the body id),
 * so a race with and without it simulates the same ticks (tests/game/rally/sound.test.ts). Attach
 * it in the scene's `enter` after the runner exists:
 *
 * ```ts
 * this.sound = attachRallySound(runner, app.audio);   // enter (after `new RallyRunner`)
 * this.sound.tick();                                   // every update (also the fold / fly-over)
 * this.sound.pause(); this.sound.resume();             // pause() / resume()
 * this.sound.detach();                                 // exit
 * ```
 */
import { closingSpeed, dopplerPitch, ENGINE_VOICES, hasSfx, stereoPan, type AudioOut, type EngineOpts, type SfxOpts } from '../../engine/audio';
import { cosT, sinT } from '../../engine/r3/trig';
import type { CarState, CarPhys, RallyBody } from './api';
import { BODY_LIGHT } from './ids';
import type { RallyRunner } from './runner';

// ---------------------------------------------------------------------------------------------
// Tables (pure)
// ---------------------------------------------------------------------------------------------

/** How a car's engine sounds (`AudioOut.engine` opts, plus the rpm range and a belt drive). */
export interface EngineVoiceSpec {
  readonly cyl: number;
  /** A pitch multiplier on top of the firing frequency (deep < 1 < high). */
  readonly pitch: number;
  readonly rough: number;
  readonly bright: number;
  readonly turbo: number;
  /** The rpm range × (a small engine revs higher). Default 1. */
  readonly rpmScale?: number;
  /** A belt drive (ACHTERUIT): no gears, one droning note that rises a little with speed. */
  readonly cvt?: boolean;
}

/** The estates (DE ROZZERS, MAJOR COCKTAILS): a five-cylinder with a turbo whine. */
export const ESTATE_ENGINE: EngineVoiceSpec = { cyl: 5, pitch: 1, rough: 0.35, bright: 0.55, turbo: 0.7 };
/** A car without its own entry (the stub rival). */
export const DEFAULT_ENGINE: EngineVoiceSpec = { cyl: 6, pitch: 1, rough: 0.3, bright: 0.5, turbo: 0 };

/** Each car's engine by its id (the estates `white` / `green`; the team ids of content/rally/teams). */
export const CAR_ENGINES: Readonly<Record<string, EngineVoiceSpec>> = {
  white: ESTATE_ENGINE,
  green: ESTATE_ENGINE,
  // DE LAATSTE RIT, the hearse: a deep, smooth six.
  'laatste-rit': { cyl: 6, pitch: 0.62, rough: 0.1, bright: 0.2, turbo: 0 },
  // OMA TRUUS, the tiny hatchback: a high, buzzy three that revs to the sky.
  'oma-truus': { cyl: 3, pitch: 1.45, rough: 0.5, bright: 0.9, turbo: 0, rpmScale: 1.25 },
  // VRIJGEZELLEN, the stretch limo: a lazy, burbling eight.
  vrijgezellen: { cyl: 8, pitch: 0.7, rough: 0.22, bright: 0.38, turbo: 0 },
  // DE FRIETBAK, the snack van: a clattering four.
  frietbak: { cyl: 4, pitch: 0.82, rough: 0.65, bright: 0.35, turbo: 0 },
  // HUISJE OP WIELEN, the camper: an old, rough four.
  huisje: { cyl: 4, pitch: 0.95, rough: 0.55, bright: 0.45, turbo: 0, rpmScale: 0.9 },
  // ACHTERUIT, the belt drive: a two-cylinder that drones on one note, the belt whining over it.
  achteruit: { cyl: 2, pitch: 1.25, rough: 0.6, bright: 0.7, turbo: 0.5, cvt: true },
  // DE IJSCOMAN, the ice-cream van: a plain four (its tune does the talking).
  ijscoman: { cyl: 4, pitch: 0.9, rough: 0.4, bright: 0.4, turbo: 0 },
};

export function engineVoiceOf(id: string): EngineVoiceSpec {
  return CAR_ENGINES[id] ?? DEFAULT_ENGINE;
}

/** Engine speed (rpm) bounds of the mapping. */
export const IDLE_RPM = 850;
export const LOW_RPM = 1100;
export const REDLINE_RPM = 6800;

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);

/**
 * The engine speed of a car (pure): standing (|speed| < 1 m/s) the idle, revving with the gas (the
 * grid); moving `LOW_RPM` … `REDLINE_RPM` from DRIVE's `rev` (0..1, it drops at each upshift); a
 * belt drive (`cvt`) one note that rises with the speed. Blended over 1 … 4 m/s.
 */
export function engineRpm(rev: number, speed: number, gas: number, spec: EngineVoiceSpec = ESTATE_ENGINE): number {
  const g = clamp01(gas);
  const v = Math.abs(speed);
  const idle = IDLE_RPM + g * 3200;
  const run = spec.cvt ? 3000 + 2200 * clamp01(v / 40) + 600 * g : LOW_RPM + clamp01(rev) * (REDLINE_RPM - LOW_RPM);
  const k = clamp01((v - 1) / 3);
  return (idle + (run - idle) * k) * (spec.rpmScale ?? 1);
}

/**
 * A distance gain (pure): 1 within `ref` m, then ref / d (−6 dB per doubling), faded to 0 over the
 * last quarter before `max`.
 */
export function distanceGain(d: number, ref: number, max: number): number {
  if (!(d < max)) return 0;
  const g = d > ref ? ref / d : 1;
  const edge = (max - d) / (0.25 * max);
  return edge < 1 ? g * edge : g;
}

/** The horn of a body that honks: a rival's team horn (its spec's `horn`), traffic by its size. */
export function hornOf(body: RallyBody): string {
  const spec = (body as Partial<CarState>).spec as { horn?: string } | undefined;
  if (spec?.horn) return spec.horn;
  const id = body.id;
  if (id.startsWith('lorry') || id.startsWith('coach')) return 'rally/horn/air';
  if (id.startsWith('van') || id.startsWith('parcel')) return 'rally/horn/car-long';
  return hashId(id) & 1 ? 'rally/horn/car-long' : 'rally/horn/car';
}

/** A small stable hash of an id (cosmetic picks without an rng). */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The mix (vol 0..1 on the sfx bus, before the output's own volumes; the radio is the music and
 * voice buses). Measured 2026-10-23 (tests/game/rally/sound-browser.test.ts; docs/api/rally.md "C.S"):
 * an estate at full load near the redline is about −23 LUFS in the mix (with the output's sfx volume
 * 0.8): 8 LU under a DJ line (−15), 2.6 LU under a song (−20.4), 11 LU under the DJ while he talks.
 */
export const MIX = {
  /** A player's engine (1P) and each one in 2P. */
  player: 0.18,
  player2p: 0.13,
  /** A rival's engine within `engineRef` m (then the distance gain to `engineRange`). */
  rival: 0.18,
  engineRef: 8,
  engineRange: 110,
  /** In a tunnel the engines come up (the walls). */
  tunnel: 1.25,
  /** Engines and wind while a voice speaks (the DJ): −3 dB. */
  djDuck: 0.7,
  squeal: 0.8,
  scrape: 0.85,
  wind: 0.55,
  siren: 0.8,
  sirenRef: 25,
  sirenRange: 420,
  ijsco: 0.75,
  ijscoRange: 90,
  arrow: 0.6,
  arrowRange: 160,
  whoosh: 0.9,
  horn: 0.8,
  hornRange: 220,
  bump: 0.85,
  flash: 1,
  flashFar: 0.4,
  flashRange: 180,
  tunnelBed: 0.5,
  shift: 0.45,
  handbrake: 0.6,
} as const;

/** The tunnel echo on the sfx bus (`AudioOut.setEcho`): a wide tube, a longer slap than the ring's. */
export const RALLY_TUNNEL_ECHO = Object.freeze({ delay: 0.14, feedback: 0.32, mix: 0.3 });
/** The bed under the tunnel's echo (content/sfx/ring-scenery.ts, a loop). */
export const TUNNEL_BED_SFX = 'ring/tunnel-bed';
/** The doppler's exaggeration (the game's speeds are fast, the effect stays subtle). */
export const DOPPLER_SCALE = 1.4;
export const SIREN_DOPPLER_SCALE = 1.7;

/** Every sound effect id this module can play (tests: each has a recipe once the content loaded). */
export const RALLY_SOUND_IDS: readonly string[] = [
  'rally/squeal', 'rally/scrape', 'rally/wind', 'rally/scrape-hit', 'rally/bump', 'rally/bump-hard', 'rally/crash',
  'rally/recover', 'rally/handbrake', 'rally/shift', 'rally/whoosh', 'rally/whoosh-big',
  'rally/horn/car', 'rally/horn/car-long', 'rally/horn/air', 'rally/siren', 'rally/whoop', 'rally/flitser',
  'rally/finish', 'rally/finish-win', 'rally/arrow-beep', 'rally/ijsco-tune', TUNNEL_BED_SFX,
  // The countdown (wave A's lazy recipes, content/rally/sfx.ts).
  'rally/count', 'rally/go',
];

// ---------------------------------------------------------------------------------------------
// The listener
// ---------------------------------------------------------------------------------------------

export interface RallySoundOpts {
  /** Also the countdown beeps, the GO, the player's flash and the pull-over (the scene's old placeholders). Default true. */
  cues?: boolean;
}

/** What the module plays now (tests, the debug overlay). */
export interface RallySoundState {
  /** Engine keys that sound (players first). */
  readonly engines: readonly string[];
  /** Loop keys that sound. */
  readonly loops: readonly string[];
  readonly echo: boolean;
  /** The DJ duck factor now (1 = none). */
  readonly duck: number;
}

export interface RallySound {
  /** Once per scene update, after the race step (also during the fold and the fly-over: the grid idles). */
  tick(): void;
  /** The pause menu: the loops and the engines go silent (they keep running underneath). */
  pause(): void;
  resume(): void;
  /** Stop every sound and listener (the scene's exit). Safe twice. */
  detach(): void;
  readonly state: RallySoundState;
}

/** One listener: a player's car this tick. */
interface Ear {
  car: CarState;
  x: number;
  z: number;
  /** Forward and right (x, z) and the velocity. */
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  vx: number;
  vz: number;
}

/** A sound source seen from its nearest ear. */
interface Seen {
  ear: Ear | null;
  d: number;
  pan: number;
  closing: number;
}

interface LoopSlot {
  readonly key: string;
  id: string;
  on: boolean;
  used: boolean;
  vol: number;
  pitch: number;
  pan: number;
  /** Ticks since the last send (a refresh every few ticks: the context may have started meanwhile). */
  age: number;
}

interface EngineSlot {
  readonly key: string;
  car: CarState;
  /** The smoothed doppler pitch. */
  pitch: number;
  prevGear: number;
  /** Ticks of the lift after an upshift. */
  lift: number;
  readonly o: EngineOpts;
}

/** Per-body cached keys (no string building per tick). */
interface Keys {
  eng: string;
  sq: string;
  scr: string;
  siren: string;
  arrow: string;
}

const TUNNEL_NONE = -1;

/** Start the race's sound on a runner (see the module doc). Safe to call before `start()`. */
export function attachRallySound(runner: RallyRunner, audio: AudioOut, o: RallySoundOpts = {}): RallySound {
  const cues = o.cues !== false;
  let alive = true;
  let t = 0;
  let duck = 1;
  let echo = false;
  /** The race tick at the last `tick()` (−1: none yet; the first tick only takes it). */
  let lastRaceTick = -1;
  let lastCount = -1;
  let roster = -1;
  let paused = false;
  const offs: Array<() => void> = [];
  const ears: Ear[] = [newEar(), newEar()];
  let earN = 0;
  const seen: Seen = { ear: null, d: Infinity, pan: 0, closing: 0 };
  const one: SfxOpts = { vol: 1, pitch: 1, pan: 0 };
  const loops = new Map<string, LoopSlot>();
  const engines = new Map<string, EngineSlot>();
  const keyCache = new WeakMap<RallyBody, Keys>();
  const handbrake = [false, false];
  // Rival engine picks (indices into `runner.cars`), refreshed every PICK_EVERY ticks.
  const picks: CarState[] = [];
  const pickD: number[] = [];
  // The whoosh: each body's last longitudinal offset from each ear (NaN = unknown) and a cooldown.
  let ahead = new Float32Array(0);
  let whooshT = new Uint8Array(0);
  const trucks: RallyBody[] = [];
  const police: RallyBody[] = [];
  let ijsco: CarState | null = null;
  const tunnels = (runner.track as { readonly tunnels?: readonly { readonly s0: number; readonly s1: number }[] }).tunnels ?? [];

  const keysOf = (b: RallyBody): Keys => {
    let k = keyCache.get(b);
    if (!k) {
      k = { eng: `rally/eng/${b.id}`, sq: `rally/sq/${b.id}`, scr: `rally/scr/${b.id}`, siren: `rally/siren/${b.id}`, arrow: `rally/arrow/${b.id}` };
      keyCache.set(b, k);
    }
    return k;
  };

  const play = (id: string, vol: number, pan = 0, pitch = 1): void => {
    if (!alive || vol <= 0.01 || !hasSfx(id)) return;
    one.vol = vol > 1 ? 1 : vol;
    one.pan = pan;
    one.pitch = pitch;
    audio.sfx(id, one);
  };

  /** Look at a world point from the nearest ear (into `seen`). */
  const look = (x: number, z: number, vx: number, vz: number): Seen => {
    seen.ear = null;
    seen.d = Infinity;
    for (let i = 0; i < earN; i++) {
      const e = ears[i];
      const dx = x - e.x;
      const dz = z - e.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < seen.d) {
        seen.d = d;
        seen.ear = e;
      }
    }
    const e = seen.ear;
    if (!e) return seen;
    const dx = x - e.x;
    const dz = z - e.z;
    seen.pan = stereoPan(dx * e.rx + dz * e.rz, dx * e.fx + dz * e.fz, earN > 1 ? 0.45 : 0.85);
    seen.closing = closingSpeed(dx, dz, vx - e.vx, vz - e.vz);
    return seen;
  };
  const lookBody = (b: RallyBody): Seen => look(b.pos[0], b.pos[2], sinT(b.yaw) * b.speed, cosT(b.yaw) * b.speed);

  const findBody = (id: string): RallyBody | null => {
    const bodies = runner.bodies;
    for (let i = 0; i < bodies.length; i++) if (bodies[i].id === id) return bodies[i];
    return null;
  };

  // ---- loops
  const want = (key: string, id: string, vol: number, pitch = 1, pan = 0): void => {
    if (vol <= 0.01) return;
    let s = loops.get(key);
    if (!s) {
      s = { key, id, on: false, used: false, vol: -1, pitch: 1, pan: 0, age: 0 };
      loops.set(key, s);
    }
    s.used = true;
    s.age++;
    const v = vol > 1 ? 1 : vol;
    if (!s.on || s.id !== id || s.age >= 8 || Math.abs(s.vol - v) > 0.01 || Math.abs(s.pitch - pitch) > 0.004 || Math.abs(s.pan - pan) > 0.02) {
      if (!hasSfx(id)) return;
      s.on = true;
      s.id = id;
      s.vol = v;
      s.pitch = pitch;
      s.pan = pan;
      s.age = 0;
      one.vol = v;
      one.pitch = pitch;
      one.pan = pan;
      audio.sfxLoop?.(key, id, one);
    }
  };
  const flushLoops = (): void => {
    for (const s of loops.values()) {
      if (!s.used && s.on) {
        s.on = false;
        s.vol = -1;
        audio.stopSfx?.(s.key, 8);
      }
      s.used = false;
    }
  };

  // ---- engines
  const engineSlot = (car: CarState): EngineSlot => {
    const key = keysOf(car).eng;
    let e = engines.get(key);
    if (!e) {
      const spec = engineVoiceOf(car.id);
      e = { key, car, pitch: 1, prevGear: car.phys.gear, lift: 0, o: { rpm: IDLE_RPM, load: 0, pan: 0, vol: 0, cyl: spec.cyl, pitch: spec.pitch, turbo: spec.turbo, rough: spec.rough, bright: spec.bright } };
      engines.set(key, e);
    }
    e.car = car;
    return e;
  };
  /** Stop the voices of the cars that no longer sound (before new ones start: never more than ENGINE_VOICES). */
  const dropEngines = (): void => {
    const cars = runner.cars;
    for (const [key, e] of engines) {
      const c = e.car;
      if ((c.slot >= 0 && cars.indexOf(c) >= 0) || picks.indexOf(c) >= 0) continue;
      audio.stopEngine?.(key, 10);
      engines.delete(key);
    }
  };

  const gasOf = (i: number): number => {
    const inp = runner.inputs[i];
    return inp ? inp.gas / 127 : 0;
  };
  const tunnelK = (): number => (echo ? MIX.tunnel : 1);

  const playerEngine = (car: CarState, i: number, slotIdx: number): void => {
    const e = engineSlot(car);
    const spec = engineVoiceOf(car.id);
    const ph = car.phys;
    // An upshift: the lift (no load for a moment) and, for a turbo, the blow-off.
    if (ph.gear > e.prevGear && e.prevGear >= 1 && Math.abs(car.speed) > 5) {
      e.lift = 5;
      if (spec.turbo > 0) play('rally/shift', MIX.shift, earN > 1 ? (slotIdx ? 0.25 : -0.25) : 0);
    }
    e.prevGear = ph.gear;
    const gas = gasOf(i);
    const lifting = e.lift > 0;
    if (lifting) e.lift--;
    const load = lifting ? 0 : car.speed > 1 ? 0.15 + 0.85 * gas : gas;
    const eo = e.o;
    eo.rpm = engineRpm(lifting ? ph.rev * 0.9 : ph.rev, car.speed, gas, spec);
    eo.load = load;
    eo.vol = (earN > 1 ? MIX.player2p : MIX.player) * duck * tunnelK();
    eo.pan = earN > 1 ? (slotIdx ? 0.25 : -0.25) : 0;
    eo.pitch = spec.pitch;
    audio.engine?.(e.key, eo);
  };

  const rivalEngine = (car: CarState, i: number): void => {
    const e = engineSlot(car);
    const spec = engineVoiceOf(car.id);
    const s = lookBody(car);
    const target = dopplerPitch(s.closing, DOPPLER_SCALE);
    e.pitch += (target - e.pitch) * 0.3;
    if (!(t & 1) || e.o.vol === 0) {
      const gas = gasOf(i);
      const eo = e.o;
      eo.rpm = engineRpm(car.phys.rev, car.speed, gas, spec);
      eo.load = car.speed > 1 ? 0.15 + 0.85 * gas : gas;
      eo.vol = MIX.rival * distanceGain(s.d, MIX.engineRef, MIX.engineRange) * duck * tunnelK();
      eo.pan = s.pan;
      eo.pitch = spec.pitch * e.pitch;
      if (eo.vol < 0.004) eo.vol = 0.004;
      audio.engine?.(e.key, eo);
    }
  };

  /** Pick the rivals nearest a player for the free engine voices (with a little stickiness). */
  const pickRivals = (): void => {
    const free = Math.max(0, Math.min(3, ENGINE_VOICES - earN));
    const old = picks.slice(0, picks.length);
    picks.length = 0;
    pickD.length = 0;
    if (free === 0) return;
    const cars = runner.cars;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (c.slot >= 0) continue;
      const s = lookBody(c);
      let d = s.d;
      if (!(d < MIX.engineRange)) continue;
      if (old.indexOf(c) >= 0) d *= 0.8;
      // Insert sorted (at most `free`).
      let k = pickD.length;
      while (k > 0 && pickD[k - 1] > d) k--;
      if (k >= free) continue;
      picks.splice(k, 0, c);
      pickD.splice(k, 0, d);
      if (picks.length > free) {
        picks.length = free;
        pickD.length = free;
      }
    }
  };

  /** The tunnel a point is in (its index) or TUNNEL_NONE. */
  const tunnelAt = (s: number): number => {
    for (let i = 0; i < tunnels.length; i++) {
      const tn = tunnels[i];
      const inside = tn.s0 <= tn.s1 ? s >= tn.s0 && s <= tn.s1 : s >= tn.s0 || s <= tn.s1;
      if (inside) return i;
    }
    return TUNNEL_NONE;
  };

  /** Rebuild the per-body tables after the roster changed (a join, the pools at install). */
  const rebuild = (): void => {
    roster = runner.roster;
    const n = runner.bodies.length;
    ahead = new Float32Array(n * 2).fill(Number.NaN);
    whooshT = new Uint8Array(n);
    trucks.length = 0;
    police.length = 0;
    ijsco = null;
    for (const b of runner.bodies) {
      if (b.kind === 'police') police.push(b);
      else if (b.kind === 'prop' && b.id.startsWith('rw-truck')) trucks.push(b);
    }
    for (const c of runner.cars) if (c.id === 'ijscoman') ijsco = c;
  };

  // ---- the events
  const ev = runner.events;
  offs.push(
    ev.on('start', () => {
      if (cues) play('rally/go', 1);
    }),
    ev.on('flash', (e) => {
      if (e.slot >= 0) {
        if (cues) play('rally/flitser', MIX.flash);
        return;
      }
      const b = findBody(e.car);
      if (!b) return;
      const s = lookBody(b);
      play('rally/flitser', MIX.flashFar * distanceGain(s.d, 20, MIX.flashRange), s.pan);
    }),
    ev.on('pulledOver', (e) => {
      if (cues && e.slot >= 0) play('rally/whoop', 0.9);
    }),
    ev.on('scrape', (e) => {
      const b = findBody(e.car);
      const k = clamp01(e.speed / 30) * 0.8 + 0.2;
      if (e.slot >= 0) {
        play('rally/scrape-hit', MIX.bump * k, e.side * (earN > 1 ? 0.3 : 0.6));
        return;
      }
      if (!b) return;
      const s = lookBody(b);
      play('rally/scrape-hit', MIX.bump * k * distanceGain(s.d, 8, 80), s.pan);
    }),
    ev.on('bump', (e) => {
      const id = e.dv >= 7 ? 'rally/bump-hard' : 'rally/bump';
      const k = Math.max(0.25, clamp01(e.dv / 8));
      if (e.slotA >= 0 || e.slotB >= 0) {
        play(id, MIX.bump * k);
        return;
      }
      const b = findBody(e.a);
      if (!b) return;
      const s = lookBody(b);
      play(id, MIX.bump * k * distanceGain(s.d, 8, 90), s.pan);
    }),
    ev.on('crash', (e) => {
      const b = findBody(e.other) ?? findBody(e.car);
      if (!b) return;
      const s = lookBody(b);
      play('rally/crash', e.slot >= 0 ? 1 : distanceGain(s.d, 10, 140), s.pan);
    }),
    ev.on('recover', (e) => {
      if (e.slot >= 0) play('rally/recover', 0.8, earN > 1 ? (e.slot ? 0.25 : -0.25) : 0);
    }),
    ev.on('honk', (e) => {
      const b = findBody(e.car);
      if (!b) return;
      const s = lookBody(b);
      play(hornOf(b), MIX.horn * distanceGain(s.d, 12, MIX.hornRange), s.pan, dopplerPitch(s.closing, DOPPLER_SCALE));
    }),
    ev.on('finish', (e) => {
      if (e.slot >= 0 && !e.projected) play(e.place === 1 ? 'rally/finish-win' : 'rally/finish', 0.9);
    }),
  );

  // ---- every tick
  const tick = (): void => {
    if (!alive) return;
    t++;
    if (runner.roster !== roster) rebuild();
    // The ears: the players' cars.
    earN = 0;
    const cars = runner.cars;
    for (let i = 0; i < cars.length && earN < 2; i++) {
      const c = cars[i];
      if (c.slot < 0) continue;
      const e = ears[earN++];
      e.car = c;
      e.x = c.pos[0];
      e.z = c.pos[2];
      const sy = sinT(c.yaw);
      const cy = cosT(c.yaw);
      e.fx = sy;
      e.fz = cy;
      e.rx = -cy;
      e.rz = sy;
      e.vx = sy * c.speed;
      e.vz = cy * c.speed;
    }
    // The DJ duck (smoothed).
    const target = audio.speaking?.() ? MIX.djDuck : 1;
    duck += (target - duck) * 0.12;
    // The countdown beeps (only while the race steps: the fold and the fly-over wait).
    const raceTick = runner.race.tick;
    if (cues && lastRaceTick >= 0 && raceTick !== lastRaceTick) {
      const c = runner.phase === 'grid' ? Math.ceil(runner.countdown / 60) : 0;
      if (c !== lastCount) {
        if (c > 0) play('rally/count', 1);
        lastCount = c;
      }
    }
    lastRaceTick = raceTick;
    // The tunnels: the echo and the bed while a player is inside one.
    let inTunnel = false;
    for (let i = 0; i < earN; i++) if (tunnelAt(ears[i].car.s) !== TUNNEL_NONE) inTunnel = true;
    if (inTunnel !== echo) {
      echo = inTunnel;
      audio.setEcho?.(echo ? RALLY_TUNNEL_ECHO : null);
    }
    if (echo) want('rally/tunnel', TUNNEL_BED_SFX, MIX.tunnelBed);
    // Engines: the players every tick, the nearest rivals (picked every 10 ticks) every other tick.
    let gone = false;
    for (const c of picks) if (cars.indexOf(c) < 0) gone = true;
    if (t % 10 === 1 || gone) pickRivals();
    dropEngines();
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (c.slot >= 0) playerEngine(c, i, c.slot === 1 ? 1 : 0);
    }
    for (const c of picks) rivalEngine(c, cars.indexOf(c));
    // Tyres, the barrier, the wind (players and the rivals that sound).
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const player = c.slot >= 0;
      if (!player && picks.indexOf(c) < 0) continue;
      tyres(c, i, player);
    }
    for (let i = 0; i < earN; i++) {
      const c = ears[i].car;
      const v = Math.abs(c.speed);
      const w = clamp01((v - 22) / 38);
      const lvl = w * Math.sqrt(w);
      const p1 = c.slot === 1;
      want(p1 ? 'rally/wind/p1' : 'rally/wind/p0', 'rally/wind', MIX.wind * lvl * duck * (echo ? 0.6 : 1), 0.85 + 0.3 * clamp01(v / 60), earN > 1 ? (p1 ? 0.2 : -0.2) : 0);
    }
    world();
    if (earN > 0 && runner.phase !== 'grid') whooshes();
    flushLoops();
  };

  const tyres = (c: CarState, i: number, player: boolean): void => {
    const ph: CarPhys = c.phys;
    const v = Math.abs(c.speed);
    const keys = keysOf(c);
    let g = 1;
    let pan = 0;
    if (!player) {
      const s = lookBody(c);
      g = distanceGain(s.d, 6, 60);
      pan = s.pan;
    } else if (earN > 1) pan = c.slot ? 0.25 : -0.25;
    // The squeal: the slip, the handbrake, a player's hard braking at speed (the AI brakes hard in every bend).
    const inp = runner.inputs[i];
    let sq = clamp01((Math.abs(ph.slip) - 1.5) / 4.5);
    if (inp?.handbrake && v > 8) sq = Math.max(sq, 0.6 * clamp01(v / 25));
    if (player && inp && inp.brake > 90 && v > 15) sq = Math.max(sq, 0.35);
    if (v > 3 && sq > 0) want(keys.sq, 'rally/squeal', MIX.squeal * sq * g, 0.9 + 0.2 * clamp01(v / 50), pan);
    // The handbrake's ratchet (a player pulls it at speed).
    if (player) {
      const hb = inp?.handbrake === true;
      const s = c.slot === 1 ? 1 : 0;
      if (hb && !handbrake[s] && v > 8) play('rally/handbrake', MIX.handbrake, pan);
      handbrake[s] = hb;
    }
    // The barrier: a grind while it touches.
    if (ph.scrape > 0 && v > 2) {
      const side = player ? ph.scrapeSide * (earN > 1 ? 0.3 : 0.6) : pan;
      want(keys.scr, 'rally/scrape', MIX.scrape * clamp01(0.2 + v / 30) * g, 0.85 + 0.3 * clamp01(v / 50), side);
    }
  };

  /** The police sirens, DE IJSCOMAN's tune, the arrow trucks. */
  const world = (): void => {
    if (earN === 0) return;
    // Sirens: the two nearest police cars with their blue lights on.
    let n1: RallyBody | null = null;
    let n2: RallyBody | null = null;
    let d1 = Infinity;
    let d2 = Infinity;
    for (const b of police) {
      if (b.hidden || !((b.lights ?? 0) & BODY_LIGHT.blue)) continue;
      const d = lookBody(b).d;
      if (d < d1) {
        n2 = n1;
        d2 = d1;
        n1 = b;
        d1 = d;
      } else if (d < d2) {
        n2 = b;
        d2 = d;
      }
    }
    if (n1) siren(n1);
    if (n2) siren(n2);
    // DE IJSCOMAN's tune when it is near.
    const ij = ijsco;
    if (ij && runner.cars.indexOf(ij) >= 0) {
      const s = lookBody(ij);
      const g = distanceGain(s.d, 10, MIX.ijscoRange);
      if (g > 0) want('rally/ijsco', 'rally/ijsco-tune', MIX.ijsco * g, dopplerPitch(s.closing, DOPPLER_SCALE), s.pan);
    }
    // The arrow-board trucks of the road works.
    for (const b of trucks) {
      if (b.hidden) continue;
      const s = lookBody(b);
      const g = distanceGain(s.d, 12, MIX.arrowRange);
      if (g > 0) want(keysOf(b).arrow, 'rally/arrow-beep', MIX.arrow * g, 1, s.pan);
    }
  };

  const sirenPitch = new Map<string, number>();
  const siren = (b: RallyBody): void => {
    const s = lookBody(b);
    const key = keysOf(b).siren;
    const target = dopplerPitch(s.closing, SIREN_DOPPLER_SCALE);
    const p0 = sirenPitch.get(key) ?? target;
    const p = p0 + (target - p0) * 0.3;
    sirenPitch.set(key, p);
    want(key, 'rally/siren', MIX.siren * distanceGain(s.d, MIX.sirenRef, MIX.sirenRange), p, s.pan);
  };

  /** The passing whoosh: traffic or a rival crossing a player's nose or tail close and fast. */
  const whooshes = (): void => {
    const bodies = runner.bodies;
    for (let j = 0; j < bodies.length; j++) {
      if (whooshT[j] > 0) whooshT[j]--;
      const b = bodies[j];
      if (b.hidden || b.kind === 'prop') continue;
      for (let i = 0; i < earN; i++) {
        const e = ears[i];
        if (b === e.car) continue;
        const dx = b.pos[0] - e.x;
        const dz = b.pos[2] - e.z;
        const a = dx * e.fx + dz * e.fz;
        const r = dx * e.rx + dz * e.rz;
        const k = j * 2 + i;
        const was = ahead[k];
        const near = Math.abs(r) < 8 && Math.abs(a) < 30;
        ahead[k] = near ? a : Number.NaN;
        if (!near || Number.isNaN(was) || whooshT[j] > 0) continue;
        if ((was > 0 && a <= 0) || (was < 0 && a >= 0)) {
          // The relative speed along the ear's heading.
          const rel = Math.abs(sinT(b.yaw) * b.speed * e.fx + cosT(b.yaw) * b.speed * e.fz - e.car.speed);
          if (rel < 12) continue;
          whooshT[j] = 30;
          const big = b.id.startsWith('lorry') || b.id.startsWith('coach');
          const vol = MIX.whoosh * clamp01((rel - 10) / 30 + 0.25) * (1 - Math.abs(r) / 9);
          play(big ? 'rally/whoosh-big' : 'rally/whoosh', vol, Math.sign(r) * (earN > 1 ? 0.3 : 0.6), 0.9 + 0.2 * clamp01(rel / 50));
        }
      }
    }
  };

  const stopAllSounds = (): void => {
    for (const s of loops.values()) if (s.on) audio.stopSfx?.(s.key, 8);
    loops.clear();
    for (const key of engines.keys()) audio.stopEngine?.(key, 8);
    engines.clear();
    if (echo) audio.setEcho?.(null);
    echo = false;
  };

  return {
    tick,
    pause() {
      if (!alive || paused) return;
      paused = true;
      audio.pauseLoops?.();
    },
    resume() {
      if (!alive || !paused) return;
      paused = false;
      audio.resumeLoops?.();
    },
    detach() {
      if (!alive) return;
      for (const off of offs) off();
      offs.length = 0;
      stopAllSounds();
      if (paused) audio.resumeLoops?.();
      paused = false;
      alive = false;
    },
    get state(): RallySoundState {
      const eng: string[] = [];
      for (const e of engines.values()) if (e.car.slot >= 0) eng.push(e.key);
      for (const e of engines.values()) if (e.car.slot < 0) eng.push(e.key);
      const lp: string[] = [];
      for (const s of loops.values()) if (s.on) lp.push(s.key);
      return { engines: eng, loops: lp, echo, duck };
    },
  };
}

function newEar(): Ear {
  return { car: null as unknown as CarState, x: 0, z: 0, fx: 0, fz: 1, rx: -1, rz: 0, vx: 0, vz: 0 };
}
