/**
 * Sound effects (GDD §12.1, §15.7; docs/api/sfx.md): every GDD id is registered and renders
 * cleanly, levels stay under the agreed ceiling and inside the loudness plan, lengths follow the
 * GDD numbers, loops are seamless, aliases resolve to the very same sound, and the synth's own
 * recipes (engine defaults) still render exactly as before the additive synth work.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../../src/engine/music';
import {
  getSfxRecipe,
  hasSfx,
  hashSeed,
  recipeLength,
  renderRecipe,
  renderSfx,
  SAMPLE_RATE,
  sfxIsLoop,
  sfxJitter,
  sfxLimits,
  UI_SFX,
  type SfxRecipe,
} from '../../src/engine/synth';
import { ARIA_STEPS, ENEMY_DIE_SFX, SFX, SFX_ALIASES, SFX_LOOPS } from '../../src/game/content/sfx/index';

// ------------------------------------------------------------------------------------------ helpers

/** The ids of GDD §15.7, read from the design document itself (so the list never drifts). */
function gddSfxIds(): string[] {
  const gdd = readFileSync(new URL('../../docs/GAME_DESIGN.md', import.meta.url), 'utf8');
  const start = gdd.indexOf('### 15.7 Sound effects');
  const end = gdd.indexOf('### 15.8', start);
  const section = gdd.slice(start, end);
  return [...new Set([...section.matchAll(/`([a-z0-9-]+\/[a-z0-9-]+)`/g)].map((m) => m[1]))];
}

function peakOf(s: Float32Array): number {
  let p = 0;
  for (let i = 0; i < s.length; i++) p = Math.max(p, Math.abs(s[i]));
  return p;
}

function meanOf(s: Float32Array): number {
  let m = 0;
  for (let i = 0; i < s.length; i++) m += s[i];
  return m / Math.max(1, s.length);
}

/** One RBJ / BS.1770 biquad as a closure. */
function biquad(b0: number, b1: number, b2: number, a1: number, a2: number): (x: number) => number {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/**
 * Loudness as the ear hears it: the K-weighted (BS.1770 pre-filter + RLB high-pass) maximum
 * momentary loudness over 400 ms windows (50 ms hop), in LUFS. A loop is measured over two cycles.
 */
function loudness(s: Float32Array): number {
  const fs = SAMPLE_RATE;
  let k = Math.tan((Math.PI * 1681.974450955533) / fs);
  const vh = Math.pow(10, 3.999843853973347 / 20);
  const vb = Math.pow(vh, 0.4996667741545416);
  let q = 0.7071752369554196;
  let a0 = 1 + k / q + k * k;
  const shelf = biquad((vh + (vb * k) / q + k * k) / a0, (2 * (k * k - vh)) / a0, (vh - (vb * k) / q + k * k) / a0, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0);
  k = Math.tan((Math.PI * 38.13547087602444) / fs);
  q = 0.5003270373238773;
  a0 = 1 + k / q + k * k;
  const rlb = biquad(1, -2, 1, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0);
  const w = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) w[i] = rlb(shelf(s[i]));
  const win = Math.round(0.4 * fs);
  const hop = Math.round(0.05 * fs);
  let best = -Infinity;
  for (let at = -win + hop; at < w.length; at += hop) {
    let sum = 0;
    for (let i = Math.max(0, at); i < Math.min(w.length, at + win); i++) sum += w[i] * w[i];
    if (sum > 0) best = Math.max(best, -0.691 + 10 * Math.log10(sum / win));
  }
  return best;
}

/** A loop as it plays: two cycles back to back. */
function asPlayed(id: string, s: Float32Array): Float32Array {
  if (!sfxIsLoop(id)) return s;
  const o = new Float32Array(s.length * 2);
  o.set(s, 0);
  o.set(s, s.length);
  return o;
}

const LU = new Map<string, number>();
function lu(id: string): number {
  let v = LU.get(id);
  if (v === undefined) {
    v = loudness(asPlayed(id, renderSfx(id) as Float32Array));
    LU.set(id, v);
  }
  return v;
}

const GDD_IDS = gddSfxIds();
/** Every id this module registers: its recipes and their aliases. */
const OWN_IDS = [...Object.keys(SFX), ...Object.keys(SFX_ALIASES)].sort();

/** Peak ceiling of every content sound (the limiter's own ceiling is 0.98). */
const PEAK_CEILING = 0.9;

// ------------------------------------------------------------------------------------------ ids

describe('sfx ids', () => {
  it('reads the GDD §15.7 list (about 170 ids)', () => {
    expect(GDD_IDS.length).toBeGreaterThanOrEqual(170);
    expect(GDD_IDS).toContain('swan/honk');
    expect(GDD_IDS).toContain('drum/rim');
  });

  it('registers every GDD §15.7 id', () => {
    expect(GDD_IDS.filter((id) => !hasSfx(id))).toEqual([]);
  });

  it('registers every sound the game layer plays (ARCHITECTURE §7.1)', () => {
    const used = [
      'player/jump', 'player/land', 'player/die', 'weapon/empty', 'bomb/throw', 'bomb/bounce', 'hit/armor',
      'vehicle/mount', 'vehicle/eject', 'vehicle/hit', 'vehicle/ram', 'vehicle/alarm', 'vehicle/warning',
      'item/pickup', 'item/1up', 'hostage/free', 'hostage/give',
      'ui/move', 'ui/confirm', 'ui/cancel', 'ui/pause', 'ui/timer-warn', 'ui/tally-tick', 'ui/tally-end',
      'boss/warning', 'mission/checkpoint', 'mission/time-up',
      // 2026-10-14: footsteps (missions with `footsteps`), canal splashes, the RELOAD! clack, the GO arrow.
      'player/step', 'player/splash', 'weapon/reload', 'ui/go',
    ];
    expect(used.filter((id) => !hasSfx(id))).toEqual([]);
  });

  it('every alias resolves to a recipe of this module and plays the very same samples', () => {
    for (const [alias, id] of Object.entries(SFX_ALIASES)) {
      expect(SFX[id], `${alias} → ${id}`).toBeDefined();
      expect(getSfxRecipe(alias), alias).toBe(SFX[id]);
      expect(renderSfx(alias), alias).toEqual(renderSfx(id));
      expect(sfxLimits(alias)).toEqual(sfxLimits(id));
    }
  });

  it('keeps the old alias names (never delete one)', () => {
    for (const alias of [
      'weapon/machine-gun', 'weapon/cannon', 'bomb/throw', 'bomb/bounce', 'hit/armor', 'player/respawn', 'item/bomb',
      'crate/break', 'vehicle/mount', 'vehicle/eject', 'enemy/shot', 'enemy/die', 'ui/tally-tick', 'boss/warning',
      'hostage/maestro', 'pickup/weapon', 'pickup/bombs', 'pickup/food', 'pickup/gem', 'pickup/1up',
    ]) expect(SFX_ALIASES[alias], alias).toBeDefined();
  });

  it('exports the death-yelp variants and the aria scale', () => {
    for (const id of ENEMY_DIE_SFX) expect(hasSfx(id), id).toBe(true);
    expect(ARIA_STEPS).toHaveLength(8);
    expect(ARIA_STEPS[0]).toBe(1);
    expect(ARIA_STEPS[7]).toBeCloseTo(2, 10);
  });
});

// ------------------------------------------------------------------------------------------ renders

describe('every sound renders cleanly', () => {
  it.each(OWN_IDS)('%s: finite, audible, under the ceiling, no DC, sane length', (id) => {
    const s = renderSfx(id) as Float32Array;
    expect(s).not.toBeNull();
    expect(s.every(Number.isFinite), `${id} has NaN / Infinity`).toBe(true);
    const peak = peakOf(s);
    expect(peak, `${id} peak`).toBeGreaterThan(0.18);
    expect(peak, `${id} peak`).toBeLessThanOrEqual(PEAK_CEILING);
    expect(Math.abs(meanOf(s)), `${id} DC offset`).toBeLessThan(0.02);
    const seconds = s.length / SAMPLE_RATE;
    expect(seconds, `${id} length`).toBeGreaterThanOrEqual(0.025);
    expect(seconds, `${id} length`).toBeLessThan(3);
    expect(recipeLength(getSfxRecipe(id) as SfxRecipe)).toBeCloseTo(seconds, 3);
  });

  it.each(GDD_IDS.filter((id) => !(id in SFX) && !(id in SFX_ALIASES)))('%s (engine default) renders finite under the limiter', (id) => {
    const s = renderSfx(id) as Float32Array;
    expect(s.every(Number.isFinite)).toBe(true);
    expect(peakOf(s)).toBeGreaterThan(0.1);
    expect(peakOf(s)).toBeLessThanOrEqual(0.98);
  });

  it('renders deterministically (a fresh render equals the cached one)', () => {
    for (const id of ['explosion/l', 'swan/honk', 'env/applause', 'machine/copter']) {
      expect(renderRecipe(SFX[id], hashSeed(id)), id).toEqual(renderSfx(id));
    }
  });

  it('keeps voice limits and pitch jitter in range', () => {
    for (const id of OWN_IDS) {
      const { voices, gap } = sfxLimits(id);
      expect(voices, id).toBeGreaterThanOrEqual(1);
      expect(voices, id).toBeLessThanOrEqual(6);
      expect(gap, id).toBeLessThanOrEqual(2);
      expect(sfxJitter(id), id).toBeLessThanOrEqual(0.06);
    }
    // Rapid guns spread their pitch (GDD: machine gun ±5 %).
    expect(sfxJitter('weapon/machine-gun')).toBeCloseTo(0.05, 5);
  });
});

// ------------------------------------------------------------------------------------------ GDD numbers

/** [id, seconds the GDD gives (or the telegraph in ticks / 60), tolerance in seconds]. */
const GDD_LENGTHS: readonly (readonly [string, number, number])[] = [
  ['weapon/pistol', 0.06, 0.01],
  ['weapon/machine-gun', 0.04, 0.01],
  ['weapon/shotgun', 0.3 + 0.06, 0.04], // 180 ms blast, a two-click pump at 300 ms
  ['weapon/rocket', 0.3, 0.02],
  ['weapon/flame', 0.4, 0.02],
  ['weapon/homing', 0.09 + 0.08, 0.02], // two 80 ms chirps
  ['weapon/tuba', 0.22, 0.02],
  ['weapon/bounce-mine', 0.06, 0.01],
  ['weapon/mine-bounce', 0.03, 0.01],
  ['weapon/empty', 0.03 + 0.12, 0.02], // click, then a 120 ms squeak
  ['weapon/grenade-bounce', 0.04, 0.01],
  ['weapon/knife', 0.08, 0.01],
  ['weapon/knife-pan', 0.15, 0.02],
  ['weapon/knife-wrench', 0.25, 0.02],
  ['explosion/s', 0.2, 0.02],
  ['explosion/m', 0.45, 0.06], // 400 ms burst + a short echo
  ['explosion/l', 0.92, 0.06], // 900 ms with the rumble tail
  ['hit/metal', 0.06, 0.01],
  ['hit/drum', 0.12, 0.01],
  ['player/jump', 0.06, 0.01],
  ['player/land', 0.04, 0.01],
  ['player/die', 0.82, 0.05], // 500 ms slide, then the boing
  ['player/helium-on', 0.3, 0.02],
  ['player/helium-deflate', 0.5, 0.02],
  ['player/yawn', 0.6, 0.02],
  ['swan/step', 0.05, 0.01],
  ['swan/honk', 0.4, 0.01],
  ['swan/jump', 0.22, 0.03], // squat click, the "chunk" on the take-off tick, a 150 ms hiss
  ['swan/land', 0.2, 0.02],
  ['swan/skid', 10 / 60, 0.01],
  ['swan/flap', 0.15, 0.01],
  ['swan/fold', 0.03, 0.01],
  ['swan/tired', 0.2, 0.01],
  ['swan/splash', 0.25, 0.03],
  ['swan/hiss', 6 / 60, 0.01],
  ['swan/migrate', 1.0, 0.01],
  ['enemy/alert', 0.07 + 0.04, 0.01], // 40 ms, twice
  ['enemy/aria', 0.5, 0.02],
  ['enemy/windup', 50 / 60, 0.03],
  ['enemy/grenade', 20 / 60, 0.02],
  ['enemy/tuba-inhale', 36 / 60, 0.02],
  ['enemy/cymbal-raise', 32 / 60, 0.02],
  ['enemy/cymbal-crash', 0.6, 0.02],
  ['enemy/drumroll', 30 / 60, 0.03],
  ['enemy/whistle', 20 / 60, 0.02],
  ['enemy/piccolo-whistle', 45 / 60, 0.02],
  ['enemy/bassoon-aim', 40 / 60, 0.02],
  ['machine/tank-charge', 45 / 60, 0.02],
  ['machine/scratch', 20 / 60, 0.02],
  ['machine/piano-whistle', 50 / 60, 0.02],
  ['machine/piano-crash', 0.6, 0.03],
  ['machine/pipe-charge', 30 / 60, 0.02],
  ['machine/anthem-crackle', 30 / 60, 0.02],
  ['creature/croak-build', 40 / 60, 0.02],
  ['creature/windup', 30 / 60, 0.02],
  ['creature/shush', 0.4, 0.01],
  ['boss/calliope-scale', 40 / 60, 0.05],
  ['boss/foghorn', 50 / 60, 0.03],
  ['boss/trombone-pull', 30 / 60, 0.02],
  ['boss/beater-pull', 40 / 60, 0.03],
  ['boss/piano-rattle', 40 / 60, 0.02],
  ['boss/goose-wiggle', 50 / 60, 0.01],
  ['boss/warning', 8 * 0.18, 0.03], // 440 / 554 Hz alternating, 4 times
  ['boss/scream', 1.2, 0.01],
  ['boss/voice-crack', 0.08, 0.01],
  ['boss/deflate', 1.5, 0.01],
  ['env/applause', 2.0, 0.2],
  ['env/avalanche', 2.9, 0.1], // "3 s" (a loop pass), kept under the 3 s cap of every sfx
  ['env/wind', 3.0, 0.12], // one pass = one m3 gust: 60 streak ticks + the 120-tick push
  ['vehicle/alarm', 1.0, 0.01], // one second of 8 Hz alternation
];

describe('lengths follow the GDD numbers', () => {
  it.each(GDD_LENGTHS)('%s lasts about %f s', (id, seconds, tol) => {
    expect(Math.abs(recipeLength(getSfxRecipe(id) as SfxRecipe) - seconds), id).toBeLessThanOrEqual(tol);
  });

  it('keeps the frequent sounds short (punchy, no smearing at fast repeats)', () => {
    for (const id of ['weapon/pistol', 'weapon/machine-gun', 'swan/fire', 'swan/step', 'hit/enemy', 'hit/metal', 'hit/ground', 'player/land', 'enemy/rifle']) {
      expect(recipeLength(getSfxRecipe(id) as SfxRecipe), id).toBeLessThanOrEqual(0.1);
    }
  });
});

// ------------------------------------------------------------------------------------------ loudness plan

/** Sounds that repeat every few ticks: they sit low so the mix never fatigues. */
const FREQUENT = [
  'weapon/pistol', 'weapon/machine-gun', 'weapon/vulcan', 'weapon/mine-bounce', 'weapon/grenade-bounce', 'weapon/knife',
  'hit/enemy', 'hit/metal', 'hit/ground', 'player/jump', 'player/land', 'player/step', 'swan/step', 'swan/paddle', 'swan/fire',
  'swan/fold', 'enemy/rifle', 'enemy/aim', 'machine/metronome-tick', 'machine/metronome-tock', 'ui/move', 'ui/tally-tick',
  'ui/name-letter', 'ui/timer-warn',
];
/** The big moments: blasts, boss cues and THE HONK sit on top. */
const BIG = [
  'explosion/m', 'explosion/l', 'explosion/part', 'boss/part-break', 'swan/honk', 'boss/scream', 'boss/foghorn',
  'boss/organ-chord', 'boss/goose-honk', 'machine/piano-crash', 'env/avalanche',
];

describe('loudness plan (K-weighted momentary maximum, LUFS)', () => {
  it.each(OWN_IDS)('%s sits between −30 and −9 LUFS', (id) => {
    expect(lu(id), id).toBeGreaterThanOrEqual(-30);
    expect(lu(id), id).toBeLessThanOrEqual(-9);
  });

  it('frequent sounds stay at or below −19 LUFS', () => {
    expect(FREQUENT.filter((id) => lu(id) > -18.95).map((id) => `${id} ${lu(id).toFixed(1)}`)).toEqual([]);
  });

  it('the big moments reach −15 LUFS or more', () => {
    expect(BIG.filter((id) => lu(id) < -15.05).map((id) => `${id} ${lu(id).toFixed(1)}`)).toEqual([]);
  });

  it('loops sit under the action (−18.5 LUFS or less; the avalanche roar is a big moment)', () => {
    const bed = SFX_LOOPS.filter((id) => id !== 'env/avalanche');
    expect(bed.filter((id) => lu(id) > -18.45).map((id) => `${id} ${lu(id).toFixed(1)}`)).toEqual([]);
  });

  it('explosions grow with their size and dwarf a hit', () => {
    expect(lu('explosion/s')).toBeLessThan(lu('explosion/m'));
    expect(lu('explosion/m')).toBeLessThan(lu('explosion/l'));
    expect(lu('explosion/l')).toBeLessThan(lu('explosion/xl'));
    expect(lu('explosion/s') - lu('hit/enemy')).toBeGreaterThanOrEqual(8);
  });

  it('the HONK is the loudest of the Swan’s one-shots', () => {
    const swan = Object.keys(SFX).filter((id) => id.startsWith('swan/') && id !== 'swan/honk');
    for (const id of swan) expect(lu('swan/honk'), id).toBeGreaterThan(lu(id));
  });

  it('a telegraph is never quieter than the attack it warns about by more than 6 LU', () => {
    const pairs: [string, string][] = [
      ['enemy/tuba-inhale', 'enemy/tuba-blast'],
      ['enemy/cymbal-raise', 'enemy/cymbal-crash'],
      ['creature/croak-build', 'creature/croak'],
      ['machine/piano-whistle', 'machine/piano-crash'],
    ];
    for (const [tell, hit] of pairs) expect(lu(tell) - lu(hit), `${tell} vs ${hit}`).toBeGreaterThanOrEqual(-6);
  });
});

// ------------------------------------------------------------------------------------------ loops

describe('loops', () => {
  it('are exactly the sounds the GDD wants looped (plus the ones the game loops: static, meltwater, wind, avalanche, ambience)', () => {
    expect([...SFX_LOOPS].sort()).toEqual(
      [
        'boss/bagpipe-drone', 'creature/kazoo', 'env/avalanche', 'env/ice-melt', 'env/radio-static', 'env/wind', 'machine/copter',
        'machine/tank-move', 'swan/glide', 'weapon/laser',
        // 2026-10-14 (ams and the start screens): ambience beds, the tour boat and the Swan's engine.
        'env/ams-canal', 'env/ams-street', 'ams/tour-boat', 'swan/engine', 'env/title-lake', 'ams/mayor-babble',
      ].sort(),
    );
    for (const id of SFX_LOOPS) expect(sfxIsLoop(id), id).toBe(true);
  });

  it.each([...SFX_LOOPS])('%s wraps around without a click or a level jump', (id) => {
    const s = renderSfx(id) as Float32Array;
    const seconds = s.length / SAMPLE_RATE;
    expect(seconds).toBeGreaterThanOrEqual(0.2);
    expect(seconds).toBeLessThanOrEqual(2.9);
    // The wrap (last sample → first) is no bigger a step than the loop already makes inside.
    let maxStep = 0;
    for (let i = 1; i < s.length; i++) maxStep = Math.max(maxStep, Math.abs(s[i] - s[i - 1]));
    expect(Math.abs(s[0] - s[s.length - 1])).toBeLessThanOrEqual(maxStep);
    // The level of the last 20 ms matches the first 20 ms (within 2 dB).
    const w = Math.round(0.02 * SAMPLE_RATE);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < w; i++) {
      head += s[i] * s[i];
      tail += s[s.length - 1 - i] * s[s.length - 1 - i];
    }
    expect(Math.abs(10 * Math.log10(head / tail))).toBeLessThan(2);
    // One instance per key and no start gap (sfxLoop updates the playing voice).
    expect(sfxLimits(id)).toEqual({ voices: 1, gap: 0 });
  });
});

// ------------------------------------------------------------------------------------------ synth stays additive

/**
 * Fingerprints [samples, energy to 6 digits] of the engine's default recipes and of a set of
 * recipes that touch every synth feature that existed before the additive work (waves, sweeps,
 * curves, PWM, vibrato, arpeggio, filters and their sweeps, drive, crush, delays, downsample,
 * echo, length caps), rendered with the original synth. New synth features must not change them.
 */
const ENGINE_PRINTS: Readonly<Record<string, readonly [number, number]>> = {
  'ui/move': [2470, 34.821],
  'ui/confirm': [26549, 289.144],
  'ui/cancel': [7145, 104.07],
  'ui/pause': [16406, 191.122],
  'ui/announce': [17288, 375.837],
};

const FEATURE_RECIPES: Readonly<Record<string, SfxRecipe>> = {
  'test/waves': {
    vol: 0.3,
    layers: [
      { wave: 'sine', freq: 300, to: 600, curve: 'linear', env: { a: 0.01, d: 0.1 } },
      { wave: 'triangle', freq: 200, to: 100, curve: 2, env: { a: 0.01, d: 0.1 }, delay: 0.02 },
      { wave: 'saw', freq: 110, vibrato: { rate: 6, depth: 0.5, delay: 0.02 }, env: { a: 0.005, s: 0.7, hold: 0.05, r: 0.03, d: 0.01 } },
      { wave: 'square', freq: 440, arp: [0, 4, 7], arpTime: 0.03, env: { a: 0.002, d: 0.12 }, vol: 0.5 },
      { wave: 'pulse', freq: 220, duty: 0.1, dutyTo: 0.6, env: { a: 0.002, d: 0.15 }, vol: 0.5, crush: 4 },
    ],
  },
  'test/noise': {
    vol: 0.4,
    layers: [
      { wave: 'noise', env: { a: 0.001, d: 0.2 }, filter: { type: 'lowpass', freq: 6000, to: 300, q: 1.5 }, drive: 1.5 },
      { wave: 'noise', freq: 900, env: { a: 0.001, d: 0.1 }, filter: { type: 'bandpass', freq: 800, to: 2400, time: 0.05, curve: 'linear', q: 3 } },
      { wave: 'metal', freq: 20000, env: { a: 0.001, d: 0.15 }, filter: { type: 'highpass', freq: 4000 } },
    ],
    filter: { type: 'lowpass', freq: 9000 },
    drive: 0.7,
    downsample: 2,
    echo: { delay: 0.05, feedback: 0.3, mix: 0.4 },
    length: 0.3,
  },
};

const FEATURE_PRINTS: Readonly<Record<string, readonly [number, number]>> = {
  'test/waves': [6704, 143.637],
  'test/noise': [13230, 368.949],
};

function fingerprint(s: Float32Array): [number, number] {
  let e = 0;
  for (let i = 0; i < s.length; i++) e += s[i] * s[i];
  return [s.length, Number(e.toPrecision(6))];
}

describe('the synth stays additive', () => {
  it.each(Object.keys(ENGINE_PRINTS))('engine default %s renders exactly as before', (id) => {
    expect(fingerprint(renderRecipe(UI_SFX[id], hashSeed(id)))).toEqual(ENGINE_PRINTS[id]);
  });

  it.each(Object.keys(FEATURE_PRINTS))('%s (every original feature) renders exactly as before', (id) => {
    expect(fingerprint(renderRecipe(FEATURE_RECIPES[id], hashSeed(id)))).toEqual(FEATURE_PRINTS[id]);
  });

  it('keeps the engine voice-fallback jingle (`ui/announce` is not redefined by content)', () => {
    expect(getSfxRecipe('ui/announce')).toBe(UI_SFX['ui/announce']);
  });
});
