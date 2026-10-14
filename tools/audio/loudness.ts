/**
 * BS.1770 loudness for the audio pipeline, in pure TS so the numbers match the synth's own
 * loudness plan (tests/content/sfx.test.ts measures the K-weighted maximum momentary loudness).
 *
 * - momentaryMax: the loudest 400 ms window (50 ms hop), in LUFS. Used for sfx and voice lines,
 *   so a sample lands where its synth version sits today.
 * - integrated: gated programme loudness (−70 LUFS absolute, −10 LU relative gate). Used for music.
 */

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

/** The K-weighting (pre-filter shelf + RLB high-pass) of one channel, squared. */
function kSquared(s: Float32Array, fs: number): Float64Array {
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
  for (let i = 0; i < s.length; i++) {
    const v = rlb(shelf(s[i]));
    w[i] = v * v;
  }
  return w;
}

/** K-weighted power summed over channels (BS.1770 weights 1.0 for L and R). */
function power(channels: readonly Float32Array[], fs: number): Float64Array {
  const n = channels.reduce((m, c) => Math.max(m, c.length), 0);
  const sum = new Float64Array(n);
  for (const c of channels) {
    const w = kSquared(c, fs);
    for (let i = 0; i < w.length; i++) sum[i] += w[i];
  }
  return sum;
}

/** Window mean squares: `win` samples long, every `hop` samples, windows partly outside count zeros. */
function windows(w: Float64Array, win: number, hop: number, partial: boolean): number[] {
  const prefix = new Float64Array(w.length + 1);
  for (let i = 0; i < w.length; i++) prefix[i + 1] = prefix[i] + w[i];
  const out: number[] = [];
  const start = partial ? -win + hop : 0;
  const end = partial ? w.length : w.length - win + 1;
  for (let at = start; at < end; at += hop) {
    const a = Math.max(0, at);
    const b = Math.min(w.length, at + win);
    out.push((prefix[b] - prefix[a]) / win);
  }
  return out;
}

const toLufs = (ms: number): number => (ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);

export function momentaryMax(channels: readonly Float32Array[], fs: number): number {
  const w = power(channels, fs);
  let best = -Infinity;
  for (const ms of windows(w, Math.round(0.4 * fs), Math.round(0.05 * fs), true)) best = Math.max(best, toLufs(ms));
  return best;
}

export function integrated(channels: readonly Float32Array[], fs: number): number {
  const w = power(channels, fs);
  const win = Math.round(0.4 * fs);
  let blocks = windows(w, win, Math.round(0.1 * fs), false);
  if (blocks.length === 0) blocks = windows(w, win, Math.round(0.1 * fs), true);
  const abs = blocks.filter((b) => toLufs(b) > -70);
  if (abs.length === 0) return -Infinity;
  const rel = toLufs(abs.reduce((s, b) => s + b, 0) / abs.length) - 10;
  const gated = abs.filter((b) => toLufs(b) > rel);
  return toLufs(gated.reduce((s, b) => s + b, 0) / Math.max(1, gated.length));
}

export function peak(channels: readonly Float32Array[]): number {
  let p = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
  return p;
}
