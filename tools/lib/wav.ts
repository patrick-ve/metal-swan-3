/** 16-bit PCM WAV encoder (mono or interleaved multi-channel). */

export function encodeWAV(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const nch = Math.max(1, channels.length);
  const frames = channels.reduce((n, c) => Math.max(n, c.length), 0);
  const dataBytes = frames * nch * 2;
  const out = new Uint8Array(44 + dataBytes);
  const v = new DataView(out.buffer);
  const tag = (o: number, s: string): void => {
    for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i);
  };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, nch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nch * 2, true); // byte rate
  v.setUint16(32, nch * 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  tag(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      v.setInt16(o, Math.round(s < 0 ? s * 32768 : s * 32767), true);
      o += 2;
    }
  }
  return out;
}

export interface AudioStats {
  /** Seconds. */
  duration: number;
  peak: number;
  /** RMS in dBFS over the whole sound. */
  rmsDb: number;
  /** Mean sample value (DC offset). */
  dc: number;
  /** Seconds until the level first reaches its peak. */
  attack: number;
  /** Seconds until the sound stays below −40 dBFS. */
  audible: number;
  /** Zero crossings per second / 2 ≈ a brightness hint in Hz. */
  zcrHz: number;
}

export function audioStats(s: Float32Array, sampleRate: number): AudioStats {
  let peak = 0;
  let peakAt = 0;
  let sum = 0;
  let sq = 0;
  let zc = 0;
  let lastLoud = 0;
  const quiet = Math.pow(10, -40 / 20);
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    const a = Math.abs(v);
    if (a > peak) {
      peak = a;
      peakAt = i;
    }
    if (a > quiet) lastLoud = i;
    sum += v;
    sq += v * v;
    if (i > 0 && (s[i - 1] < 0) !== (v < 0)) zc++;
  }
  const n = Math.max(1, s.length);
  const rms = Math.sqrt(sq / n);
  return {
    duration: s.length / sampleRate,
    peak,
    rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    dc: sum / n,
    attack: peakAt / sampleRate,
    audible: lastLoud / sampleRate,
    zcrHz: (zc / 2) / (n / sampleRate),
  };
}
