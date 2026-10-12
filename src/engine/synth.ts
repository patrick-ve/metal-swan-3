/**
 * Deterministic software synthesizer (docs/ARCHITECTURE.md §5.7, docs/api/media.md §9).
 *
 * A sound effect is a plain-data SfxRecipe: layers of oscillators or noise with pitch sweeps,
 * vibrato, arpeggios, ADSR envelopes, filters (with sweeps), drive and bit-crush, per-layer
 * delays, tremolo (amplitude LFO) and FM; then master filter / drive / crush / echo and a soft
 * limiter (peak <= 0.98). A recipe marked `loop` renders as a seamless loop for `sfxLoop`.
 * Rendering is pure TypeScript into a mono Float32Array at 44.1 kHz — identical in node and in
 * the browser, so sounds can be tested headless. Rendered sounds are cached per id.
 */

export const SAMPLE_RATE = 44100;

export type Wave = 'sine' | 'square' | 'pulse' | 'saw' | 'triangle' | 'noise' | 'metal';
/** Sweep shape: 'exp' (musical, default), 'linear', or a power k (t^k). */
export type Curve = 'exp' | 'linear' | number;
/** Tremolo LFO shape. Every shape starts at full gain. */
export type LfoShape = 'sine' | 'square' | 'saw' | 'triangle';

/** Amplitude modulation of a layer (AM, gates, chops, flutters). */
export interface Tremolo {
  /** LFO rate in Hz: the gain dips once per cycle. */
  rate: number;
  /** Rate at the end of the layer (an exponential sweep: accelerating ratchets and rolls). */
  rateTo?: number;
  /** How far the gain dips, 0..1 (1 = a full gate). */
  depth: number;
  /**
   * 'sine' (default), 'triangle', 'square' (a gate with soft 2–5 % edges, no clicks) or 'saw'
   * (a fast onset and a decay every cycle: rotor chops, flutters, patter).
   */
  shape?: LfoShape;
  /** Seconds before the modulation starts (full gain until then). */
  delay?: number;
  /**
   * 'saw' only: the part of a cycle the decay lasts (default 0.96: the whole cycle). Short
   * widths (0.1–0.3) make separate bursts: claps, patter, crackle.
   */
  width?: number;
}

/** FM (phase modulation) of a tonal layer by a sine at `ratio` × the layer's pitch. */
export interface FmSpec {
  /** Modulator / carrier frequency ratio (whole numbers: buzz; 1.4, 3.5 …: bells and metal). */
  ratio: number;
  /** Modulation index in radians at the start (0 = a plain tone; 2–6 = bright). */
  index: number;
  /** Index at the end: a linear sweep over the layer, or the floor of the `decay`. */
  indexTo?: number;
  /** Time constant in seconds of an exponential index decay (a bell's brightness fades first). */
  decay?: number;
}

export interface Envelope {
  /** Attack time in seconds (default 0.002). */
  a?: number;
  /** Decay time to the sustain level (default 0). */
  d?: number;
  /** Sustain level 0..1 (default 0 when `d` is set, else 1). */
  s?: number;
  /** Time held at the sustain level (default 0.1 when s > 0, else 0). */
  hold?: number;
  /** Release time (default 0.05). */
  r?: number;
}

export interface FilterSpec {
  type: 'lowpass' | 'highpass' | 'bandpass';
  /** Cutoff / centre frequency in Hz. */
  freq: number;
  /** Cutoff at the end of the sweep. */
  to?: number;
  /** Sweep time in seconds (default: the whole sound). */
  time?: number;
  curve?: Curve;
  /** Resonance (default 0.707). */
  q?: number;
}

export interface SfxLayer {
  wave: Wave;
  /** Start frequency in Hz (noise: the sample-and-hold clock; default 440, noise 44100). */
  freq?: number;
  /** End frequency of the pitch sweep. */
  to?: number;
  /** Pitch sweep time in seconds (default: the layer length). */
  sweep?: number;
  curve?: Curve;
  /** Pulse duty 0..1 (default 0.5) and its end value for a PWM sweep. */
  duty?: number;
  dutyTo?: number;
  /** Vibrato: rate in Hz, depth in semitones, optional delay in seconds. */
  vibrato?: { rate: number; depth: number; delay?: number };
  /** Arpeggio: semitone offsets cycled every `arpTime` seconds (default 0.05). */
  arp?: readonly number[];
  arpTime?: number;
  /**
   * Pitch envelope on top of the sweep: [time s, semitones] breakpoints in time order, linear in
   * semitones between them, held before the first and after the last (scoops, rise-and-fall
   * sirens, record scratches, swoops). Example: `[[0, -2], [0.07, 0], [1, -5]]`.
   */
  bend?: readonly (readonly [number, number])[];
  env?: Envelope;
  /** Layer gain (default 1). */
  vol?: number;
  /** Start offset in seconds. */
  delay?: number;
  filter?: FilterSpec;
  /** Distortion amount (0 = clean, 1 = warm, 4+ = harsh). */
  drive?: number;
  /** Bit-crush to this many bits (e.g. 4). */
  crush?: number;
  /** Amplitude LFO (applied with the envelope, before drive). */
  tremolo?: Tremolo;
  /**
   * FM / phase modulation (tonal waves only; ignored on noise). Best on 'sine' and 'triangle';
   * other waves are then drawn without band-limiting.
   */
  fm?: FmSpec;
}

export interface SfxRecipe {
  layers: readonly SfxLayer[];
  /** Master gain (default 0.8). */
  vol?: number;
  /** Hard cap on the length in seconds. */
  length?: number;
  /** Seed for noise layers (default: hash of the sfx id). */
  seed?: number;
  filter?: FilterSpec;
  drive?: number;
  crush?: number;
  /** Lo-fi: hold every N-th sample. */
  downsample?: number;
  /** Feedback echo: delay in seconds, feedback 0..0.9, wet mix (default 0.5). */
  echo?: { delay: number; feedback: number; mix?: number };
  /** Playback limits for the audio output: max simultaneous instances (default 4). */
  voices?: number;
  /** Minimum seconds between two starts of this sound (default 0.015). */
  gap?: number;
  /**
   * Seamless loop (for `AudioOut.sfxLoop`): the last `loopFade` seconds of the render are
   * cross-faded into its start and cut off, and there is no fade-out, so the end flows into the
   * start. Give the layers a flat envelope (`{ a: 0, s: 1, hold: length, r: 0 }`); tonal layers
   * loop cleanest when `freq × final length` is a whole number. `recipeLength` is the loop length.
   */
  loop?: boolean;
  /** Cross-fade length of a loop in seconds (default 0.05, at most a third of the render). */
  loopFade?: number;
  /**
   * Random playback pitch spread for the audio output (0.05 = ±5 %), so rapid repeats do not
   * sound mechanical. Data only: the renderer ignores it (`sfxJitter(id)`).
   */
  jitter?: number;
}

const TAU = Math.PI * 2;

/** FNV-1a hash → 32-bit seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** xorshift32 → [-1, 1). */
function makeNoise(seed: number): () => number {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 2147483648 - 1;
  };
}

function sweepAt(from: number, to: number, x: number, curve: Curve | undefined): number {
  if (x >= 1) return to;
  if (x <= 0) return from;
  if (curve === 'linear') return from + (to - from) * x;
  if (typeof curve === 'number') return from + (to - from) * Math.pow(x, curve);
  if (from > 0 && to > 0) return from * Math.pow(to / from, x);
  return from + (to - from) * x;
}

/** Tremolo LFO (unipolar, 1 at phase 0) for phase x in [0, 1). */
function lfoAt(shape: LfoShape | undefined, x: number, width: number | undefined): number {
  switch (shape) {
    case 'triangle':
      return Math.abs(1 - 2 * x);
    case 'square':
      // A clipped cosine: a gate whose edges take about 5 % of a cycle (no clicks).
      return Math.max(0, Math.min(1, 0.5 + 3 * Math.cos(TAU * x)));
    case 'saw': {
      // A quadratic decay over `width` of the cycle, silence, then a fast onset in the last 4 %.
      if (x >= 0.96) return (x - 0.96) / 0.04;
      const w = Math.max(0.02, Math.min(0.96, width ?? 0.96));
      if (x >= w) return 0;
      const d = 1 - x / w;
      return d * d;
    }
    default:
      return 0.5 + 0.5 * Math.cos(TAU * x);
  }
}

/** Pitch-envelope value in semitones at time t (linear between breakpoints, held at the ends). */
function bendAt(points: readonly (readonly [number, number])[], t: number): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t < t1) {
      const [t0, v0] = points[i - 1];
      return t1 > t0 ? v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) : v1;
    }
  }
  return points[points.length - 1][1];
}

/** FM index at time t of a layer `total` seconds long. */
function fmIndexAt(fm: FmSpec, t: number, total: number): number {
  if (fm.decay !== undefined && fm.decay > 0) {
    const floor = fm.indexTo ?? 0;
    return floor + (fm.index - floor) * Math.exp(-t / fm.decay);
  }
  if (fm.indexTo !== undefined) return fm.index + (fm.indexTo - fm.index) * Math.min(1, total > 0 ? t / total : 1);
  return fm.index;
}

/** Naive (not band-limited) waveform at phase p in [0, 1), used under FM. */
function rawWave(wave: Wave, p: number, duty: number): number {
  switch (wave) {
    case 'triangle':
      return 4 * Math.abs(p - 0.5) - 1;
    case 'saw':
      return 2 * p - 1;
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'pulse':
      return (p < duty ? 1 : -1) - (2 * duty - 1);
    default:
      return Math.sin(TAU * p);
  }
}

interface EnvTimes {
  a: number;
  d: number;
  s: number;
  hold: number;
  r: number;
  total: number;
}

function envTimes(e: Envelope | undefined): EnvTimes {
  const a = Math.max(0, e?.a ?? 0.002);
  const d = Math.max(0, e?.d ?? 0);
  const s = Math.max(0, Math.min(1, e?.s ?? (d > 0 ? 0 : 1)));
  const hold = Math.max(0, e?.hold ?? (s > 0 ? 0.1 : 0));
  const r = Math.max(0, e?.r ?? 0.05);
  // With no sustain the sound is over after attack + decay.
  const total = s > 0 ? a + d + hold + r : a + d;
  return { a, d, s, hold, r, total: Math.max(total, 0.001) };
}

/** Envelope level at time t (curved decay / release). */
function envAt(e: EnvTimes, t: number): number {
  if (t < 0) return 0;
  if (t < e.a) return t / e.a;
  let u = t - e.a;
  if (u < e.d) {
    const x = 1 - u / e.d;
    return e.s + (1 - e.s) * x * x;
  }
  u -= e.d;
  if (e.s <= 0) return 0;
  if (u < e.hold) return e.s;
  u -= e.hold;
  if (u < e.r) {
    const x = 1 - u / e.r;
    return e.s * x * x;
  }
  return 0;
}

/** PolyBLEP residual for band-limited steps (t = phase 0..1, dt = phase step). */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** RBJ biquad with coefficients refreshed when the cutoff moves. */
class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private readonly type: FilterSpec['type'];
  private readonly q: number;

  constructor(type: FilterSpec['type'], q: number) {
    this.type = type;
    this.q = Math.max(0.05, q);
  }

  set(freq: number): void {
    const f = Math.max(10, Math.min(SAMPLE_RATE * 0.45, freq));
    const w0 = (TAU * f) / SAMPLE_RATE;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * this.q);
    let b0: number;
    let b1: number;
    let b2: number;
    if (this.type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = b0;
    } else if (this.type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = b0;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Runs a FilterSpec over samples [0, n) of `buf`, sweeping the cutoff over time. */
function applyFilter(buf: Float32Array, start: number, n: number, spec: FilterSpec, length: number): void {
  const bq = new Biquad(spec.type, spec.q ?? 0.707);
  const sweepT = spec.time ?? length;
  const to = spec.to ?? spec.freq;
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) bq.set(sweepAt(spec.freq, to, sweepT > 0 ? i / SAMPLE_RATE / sweepT : 1, spec.curve));
    buf[start + i] = bq.run(buf[start + i]);
  }
}

function shape(v: number, drive: number | undefined, crush: number | undefined): number {
  if (drive !== undefined && drive > 0) {
    const k = 1 + drive * 2;
    v = Math.tanh(v * k) / Math.tanh(k);
  }
  if (crush !== undefined && crush > 0) {
    const steps = Math.pow(2, Math.max(1, crush) - 1);
    v = Math.round(v * steps) / steps;
  }
  return v;
}

/**
 * Length in seconds of a rendered recipe: the layers (with delays) plus the echo tail, capped
 * by `length`. A loop is shorter by its cross-fade (the loop length).
 */
export function recipeLength(r: SfxRecipe): number {
  const len = renderLength(r);
  return r.loop ? len - loopFadeSamples(r, Math.max(1, Math.ceil(len * SAMPLE_RATE))) / SAMPLE_RATE : len;
}

/** Cross-fade length in samples of a loop rendered into `n` samples. */
function loopFadeSamples(r: SfxRecipe, n: number): number {
  return Math.max(1, Math.min(Math.floor(n / 3), Math.round(Math.max(0, r.loopFade ?? 0.05) * SAMPLE_RATE)));
}

/** Length in seconds the renderer produces before a loop's cross-fade cut. */
function renderLength(r: SfxRecipe): number {
  let len = 0;
  for (const l of r.layers) len = Math.max(len, Math.max(0, l.delay ?? 0) + envTimes(l.env).total);
  if (r.echo && r.echo.delay > 0 && r.echo.feedback > 0) {
    const fb = Math.min(0.95, r.echo.feedback);
    const repeats = Math.min(40, Math.ceil(Math.log(0.01) / Math.log(fb)));
    len += Math.min(2, r.echo.delay * repeats);
  }
  if (r.length !== undefined) len = Math.min(len, Math.max(0, r.length));
  return len;
}

/** Render one layer and add it into `out`. */
function renderLayer(out: Float32Array, layer: SfxLayer, noiseSeed: number): void {
  const env = envTimes(layer.env);
  const start = Math.round(Math.max(0, layer.delay ?? 0) * SAMPLE_RATE);
  const n = Math.min(out.length - start, Math.ceil(env.total * SAMPLE_RATE));
  if (n <= 0) return;
  const isNoise = layer.wave === 'noise' || layer.wave === 'metal';
  const f0 = Math.max(1, layer.freq ?? (isNoise ? SAMPLE_RATE : 440));
  const f1 = Math.max(1, layer.to ?? f0);
  const sweepT = layer.sweep ?? env.total;
  const duty0 = Math.max(0.01, Math.min(0.99, layer.duty ?? 0.5));
  const duty1 = Math.max(0.01, Math.min(0.99, layer.dutyTo ?? duty0));
  const vol = layer.vol ?? 1;
  const vib = layer.vibrato;
  const arp = layer.arp && layer.arp.length > 0 ? layer.arp : null;
  const arpTime = Math.max(0.005, layer.arpTime ?? 0.05);
  const noise = makeNoise(noiseSeed);
  let lfsr = 0x7fff; // 15-bit LFSR for 'metal' (short mode → metallic tone)
  let held = 0;
  let phase = 0;
  const trem = layer.tremolo && layer.tremolo.rate > 0 && layer.tremolo.depth > 0 ? layer.tremolo : null;
  const fm = layer.fm && !isNoise ? layer.fm : null;
  const bend = layer.bend && layer.bend.length > 0 ? layer.bend : null;
  let tremPhase = 0;
  let modPhase = 0;
  const tmp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let f = sweepAt(f0, f1, sweepT > 0 ? t / sweepT : 1, layer.curve);
    if (vib && t >= (vib.delay ?? 0)) f *= Math.pow(2, (vib.depth / 12) * Math.sin(TAU * vib.rate * (t - (vib.delay ?? 0))));
    if (arp) f *= Math.pow(2, arp[Math.floor(t / arpTime) % arp.length] / 12);
    if (bend) f *= Math.pow(2, bendAt(bend, t) / 12);
    const dt = Math.min(0.5, f / SAMPLE_RATE);
    let v: number;
    if (fm) {
      // Phase modulation: the carrier is read at its phase plus index × the modulator.
      let p = phase + (fmIndexAt(fm, t, env.total) * Math.sin(TAU * modPhase)) / TAU;
      p -= Math.floor(p);
      v = rawWave(layer.wave, p, layer.wave === 'pulse' ? duty0 + (duty1 - duty0) * (i / n) : 0.5);
      modPhase += (f * fm.ratio) / SAMPLE_RATE;
      if (modPhase >= 1) modPhase -= Math.floor(modPhase);
    } else switch (layer.wave) {
      case 'sine':
        v = Math.sin(TAU * phase);
        break;
      case 'triangle':
        v = 4 * Math.abs(phase - 0.5) - 1;
        break;
      case 'saw':
        v = 2 * phase - 1 - polyBlep(phase, dt);
        break;
      case 'square':
      case 'pulse': {
        const duty = layer.wave === 'square' ? 0.5 : duty0 + (duty1 - duty0) * (i / n);
        v = phase < duty ? 1 : -1;
        v += polyBlep(phase, dt);
        v -= polyBlep((phase - duty + 1) % 1, dt);
        v -= 2 * duty - 1; // remove the DC offset of narrow pulses
        break;
      }
      case 'noise':
      case 'metal':
        v = held;
        break;
    }
    phase += f / SAMPLE_RATE;
    if (phase >= 1) {
      const steps = Math.floor(phase);
      phase -= steps;
      if (isNoise) {
        if (layer.wave === 'noise') held = noise();
        else {
          for (let k = 0; k < Math.min(steps, 64); k++) {
            const bit = (lfsr ^ (lfsr >> 6)) & 1;
            lfsr = (lfsr >> 1) | (bit << 14);
          }
          held = lfsr & 1 ? 1 : -1;
        }
      }
    }
    if (trem) {
      let g = 1;
      const td = t - (trem.delay ?? 0);
      if (td >= 0) {
        g = 1 - trem.depth * (1 - lfoAt(trem.shape, tremPhase, trem.width));
        tremPhase += sweepAt(trem.rate, trem.rateTo ?? trem.rate, env.total > 0 ? t / env.total : 1, 'exp') / SAMPLE_RATE;
        if (tremPhase >= 1) tremPhase -= Math.floor(tremPhase);
      }
      tmp[i] = shape(v * envAt(env, t) * vol * g, layer.drive, layer.crush);
    } else {
      tmp[i] = shape(v * envAt(env, t) * vol, layer.drive, layer.crush);
    }
  }
  if (layer.filter) applyFilter(tmp, 0, n, layer.filter, env.total);
  for (let i = 0; i < n; i++) out[start + i] += tmp[i];
}

/** Soft limiter: linear below 0.8, then a tanh knee with a 0.98 ceiling (headroom). */
function limit(v: number): number {
  const a = Math.abs(v);
  if (a <= 0.8) return v;
  const y = 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18);
  return v < 0 ? -y : y;
}

/**
 * Turns a render into a seamless loop: the last `x` samples are cross-faded into the first `x`
 * and cut off, so the last sample flows into the first. The fade law follows the correlation of
 * head and tail (linear for in-phase tones, equal-power for noise), so the level stays constant.
 */
function seamlessLoop(out: Float32Array, x: number, vol: number): Float32Array {
  const m = out.length - x;
  let hh = 0;
  let tt = 0;
  let ht = 0;
  for (let i = 0; i < x; i++) {
    const h = out[i];
    const t = out[m + i];
    hh += h * h;
    tt += t * t;
    ht += h * t;
  }
  const c = hh > 0 && tt > 0 ? ht / Math.sqrt(hh * tt) : 0;
  const rho = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0;
  const res = out.slice(0, m);
  for (let i = 0; i < x; i++) {
    const s = (i + 0.5) / x;
    const norm = Math.sqrt(s * s + (1 - s) * (1 - s) + 2 * rho * s * (1 - s));
    res[i] = (out[i] * s + out[m + i] * (1 - s)) / norm;
  }
  for (let i = 0; i < m; i++) {
    const v = res[i] * vol;
    res[i] = Number.isFinite(v) ? limit(v) : 0;
  }
  return res;
}

/** Render a recipe (uncached). `seed` defaults to recipe.seed or 1. */
export function renderRecipe(r: SfxRecipe, seed?: number): Float32Array {
  const len = renderLength(r);
  const n = Math.max(1, Math.ceil(len * SAMPLE_RATE));
  const out = new Float32Array(n);
  const base = r.seed ?? seed ?? 1;
  r.layers.forEach((layer, i) => renderLayer(out, layer, (base + Math.imul(i + 1, 0x9e3779b1)) >>> 0));
  if (r.filter) applyFilter(out, 0, n, r.filter, len);
  if (r.drive !== undefined || r.crush !== undefined) {
    for (let i = 0; i < n; i++) out[i] = shape(out[i], r.drive, r.crush);
  }
  const ds = Math.round(r.downsample ?? 1);
  if (ds > 1) for (let i = 0; i < n; i++) out[i] = out[i - (i % ds)];
  if (r.echo && r.echo.delay > 0 && r.echo.feedback > 0) {
    const d = Math.max(1, Math.round(r.echo.delay * SAMPLE_RATE));
    const fb = Math.min(0.95, r.echo.feedback);
    const mix = r.echo.mix ?? 0.5;
    const wet = new Float32Array(n);
    for (let i = d; i < n; i++) wet[i] = out[i - d] + wet[i - d] * fb;
    for (let i = 0; i < n; i++) out[i] += wet[i] * mix;
  }
  const vol = r.vol ?? 0.8;
  if (r.loop && n >= 3) return seamlessLoop(out, loopFadeSamples(r, n), vol);
  for (let i = 0; i < n; i++) {
    const v = out[i] * vol;
    out[i] = Number.isFinite(v) ? limit(v) : 0;
  }
  // Short fade-out against clicks when the length cap cuts a sound.
  const fade = Math.min(n, 64);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

// ------------------------------------------------------------------ registry

const recipes = new Map<string, SfxRecipe>();
const rendered = new Map<string, Float32Array>();
const warned = new Set<string>();

/** Register (or replace) a sound effect. Ids are slash paths: 'weapon/pistol', 'ui/confirm'. */
export function defineSfx(id: string, recipe: SfxRecipe): void {
  recipes.set(id, recipe);
  rendered.delete(id);
}

export function hasSfx(id: string): boolean {
  return recipes.has(id);
}

export function listSfx(prefix = ''): string[] {
  return [...recipes.keys()].filter((id) => id.startsWith(prefix)).sort();
}

export function getSfxRecipe(id: string): SfxRecipe | undefined {
  return recipes.get(id);
}

/** Rendered samples (cached). Unknown id → null and one warning. */
export function renderSfx(id: string): Float32Array | null {
  const cached = rendered.get(id);
  if (cached) return cached;
  const r = recipes.get(id);
  if (!r) {
    if (!warned.has(id)) {
      warned.add(id);
      console.warn(`[sfx] unknown sound "${id}" — playing nothing`);
    }
    return null;
  }
  let samples: Float32Array;
  try {
    samples = renderRecipe(r, hashSeed(id));
  } catch (err) {
    if (!warned.has(`render:${id}`)) {
      warned.add(`render:${id}`);
      console.warn(`[sfx] rendering "${id}" failed:`, err);
    }
    samples = new Float32Array(1);
  }
  rendered.set(id, samples);
  return samples;
}

/** Voice limits of a sound (defaults: 4 voices, 15 ms between starts). */
export function sfxLimits(id: string): { voices: number; gap: number } {
  const r = recipes.get(id);
  return { voices: Math.max(1, r?.voices ?? 4), gap: Math.max(0, r?.gap ?? 0.015) };
}

/** Random playback pitch spread of a sound (0.05 = ±5 %; 0 = none; at most 0.5). */
export function sfxJitter(id: string): number {
  const j = recipes.get(id)?.jitter ?? 0;
  return Number.isFinite(j) ? Math.max(0, Math.min(0.5, j)) : 0;
}

/**
 * Playback pitch of one play with jitter: `base × (1 + (2r − 1) × jitter)`, r in [0, 1). The
 * Web Audio output calls it with a cosmetic random r per play (never the simulation rng).
 */
export function jitterPitch(base: number, jitter: number, r: number): number {
  if (!(jitter > 0)) return base;
  return base * (1 + (2 * r - 1) * jitter);
}

/** True when the sound is a seamless loop (play it with `AudioOut.sfxLoop`). */
export function sfxIsLoop(id: string): boolean {
  return recipes.get(id)?.loop === true;
}

// ------------------------------------------------------------------ default UI sounds

/** Simple, pleasant menu sounds. Content modules may redefine them. */
export const UI_SFX: Readonly<Record<string, SfxRecipe>> = {
  'ui/move': {
    vol: 0.5,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: 1046.5, env: { a: 0.001, d: 0.055 }, vol: 0.55 },
      { wave: 'triangle', freq: 523.25, env: { a: 0.001, d: 0.045 }, vol: 0.5 },
    ],
  },
  'ui/confirm': {
    vol: 0.55,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: 783.99, arp: [0, 5, 12], arpTime: 0.045, env: { a: 0.002, s: 0.7, hold: 0.12, r: 0.12 }, vol: 0.45 },
      { wave: 'triangle', freq: 392, arp: [0, 5, 12], arpTime: 0.045, env: { a: 0.002, s: 0.8, hold: 0.12, r: 0.1 }, vol: 0.6 },
    ],
    echo: { delay: 0.09, feedback: 0.25, mix: 0.3 },
  },
  'ui/cancel': {
    vol: 0.5,
    layers: [
      { wave: 'pulse', duty: 0.5, freq: 622.25, to: 311.13, sweep: 0.12, env: { a: 0.002, d: 0.16 }, vol: 0.45, filter: { type: 'lowpass', freq: 3000 } },
      { wave: 'triangle', freq: 311.13, to: 155.56, sweep: 0.12, env: { a: 0.002, d: 0.14 }, vol: 0.6 },
    ],
  },
  'ui/pause': {
    vol: 0.5,
    layers: [
      { wave: 'sine', freq: 880, env: { a: 0.002, d: 0.25 }, vol: 0.6 },
      { wave: 'sine', freq: 1318.5, env: { a: 0.002, d: 0.3 }, vol: 0.45, delay: 0.07 },
      { wave: 'triangle', freq: 440, env: { a: 0.002, d: 0.2 }, vol: 0.4 },
    ],
  },
  /** Fallback for announcer lines when speech is unavailable. */
  'ui/announce': {
    vol: 0.55,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: 523.25, arp: [0, 4, 7, 12], arpTime: 0.06, env: { a: 0.002, s: 0.7, hold: 0.22, r: 0.15 }, vol: 0.4 },
      { wave: 'triangle', freq: 261.63, env: { a: 0.002, s: 0.8, hold: 0.24, r: 0.15 }, vol: 0.5 },
    ],
  },
};

for (const [id, recipe] of Object.entries(UI_SFX)) defineSfx(id, recipe);
