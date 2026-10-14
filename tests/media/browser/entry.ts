/**
 * Browser bundle for tests/media/browser.test.ts (built with Vite, run in headless Chromium).
 * Exposes window.MediaTest with the canvas renderer scenes and audio checks.
 */
import { renderSongOffline, unlock, WebAudioOut } from '../../../src/engine/audio.browser';
import type { SongDef } from '../../../src/engine/music';
import { defineSong } from '../../../src/engine/music';
import { defineSampleGroup, voiceKey } from '../../../src/engine/samples';
import { createDisplay } from '../../../src/engine/display.browser';
import { CanvasRenderer } from '../../../src/engine/render-canvas.browser';
import type { SubpixelMode } from '../../../src/engine/render-common';
import { upscaleFactor, type UpscaleMode } from '../../../src/engine/upscale';
import { drawBlendScene, drawHiScene, drawOpaqueScene } from './scene';

/** The whole backbuffer (canvas size, not the logical r.w × r.h). */
function pixels(r: CanvasRenderer): number[] {
  const data = r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
  return Array.from(data);
}

/** RGBA bytes as base64 (large backbuffers pass page.evaluate quickly). */
function base64(bytes: Uint8ClampedArray): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const ALL_INSTRUMENTS: SongDef = {
  bpm: 140,
  order: ['A'],
  channels: [
    { inst: 'pulse12', patterns: { A: 'C5 - E5 - G5 - . . C5 . . . . . . .' } },
    { inst: 'pulse25', patterns: { A: 'E4 . . . G4 . . . C5 - - - . . . .' } },
    { inst: 'square', patterns: { A: '. . C4 . . . E4 . . . G4 . . . . .' } },
    { inst: 'bass', pan: -0.3, patterns: { A: 'C2 - - - G1 - - - A1 - - - F1 - - -' } },
    { inst: 'lead', pan: 0.3, patterns: { A: 'G4 - - - - - A4 - B4 - - - C5 - - -' } },
    { inst: 'bell', patterns: { A: 'C6 . . . . . . . G5 . . . . . . .' } },
    { inst: 'pad', patterns: { A: 'C4+E4+G4 - - - - - - - F3+A3+C4 - - - - - - -' } },
    { inst: 'drums', kit: { x: 'ui/move' }, patterns: { A: 'k+c . h . s . h . k . k+h . S . o x' } },
    {
      inst: { kind: 'pulse', duty: 0.5, detune: 10, tremolo: { rate: 6, depth: 0.5 }, glide: 0.08, env: { a: 0.02, d: 0.1, s: 0.7, r: 0.1 }, vol: 0.15 },
      patterns: { A: 'G3 A3 B3 - ~D4 - - . E3 - ~G3 - . . . .' },
    },
  ],
};

defineSong('test/all', { ...ALL_INSTRUMENTS, order: ['A', 'A+5'] });
defineSong('test/a440', { bpm: 60, rowsPerBeat: 1, order: ['A'], channels: [{ inst: 'pulse25', patterns: { A: 'A4 - - -' } }] });

function stats(buf: AudioBuffer, from = 0, to = buf.length): { peak: number; rms: number; finite: boolean } {
  let peak = 0;
  let sum = 0;
  let finite = true;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = from; i < to; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) finite = false;
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, (to - from) * buf.numberOfChannels)), finite };
}

/** Fundamental frequency: the first autocorrelation peak within 90 % of the strongest one. */
function pitch(buf: AudioBuffer, from: number, n: number): number {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const lo = Math.floor(sr / 2000);
  const hi = Math.floor(sr / 50);
  const ac = new Float64Array(hi);
  let max = 0;
  for (let lag = lo; lag < hi; lag++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[from + i] * d[from + i + lag];
    ac[lag] = s;
    max = Math.max(max, s);
  }
  for (let lag = lo + 1; lag < hi - 1; lag++) {
    if (ac[lag] >= 0.9 * max && ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) return sr / lag;
  }
  return 0;
}

const api = {
  opaque(): number[] {
    const r = new CanvasRenderer();
    drawOpaqueScene(r);
    return pixels(r);
  },
  blend(): number[] {
    const r = new CanvasRenderer();
    drawBlendScene(r);
    return pixels(r);
  },
  /** A parity scene on a res-k backbuffer: canvas size and RGBA bytes (base64). */
  hires(k: number, mode: UpscaleMode, subpixel: SubpixelMode, blend: boolean): { w: number; h: number; rgba: string } {
    const r = new CanvasRenderer(undefined, undefined, undefined, { res: k, mode, subpixel });
    (blend ? drawBlendScene : drawOpaqueScene)(r);
    const w = r.canvas.width;
    const h = r.canvas.height;
    return { w, h, rgba: base64(r.ctx.getImageData(0, 0, w, h).data) };
  },
  /** The 2× art scene on a res-k backbuffer (pixel mode). */
  hiScene(k: number): { w: number; h: number; rgba: string } {
    const r = new CanvasRenderer(undefined, undefined, undefined, { res: k, mode: 'smooth' });
    drawHiScene(r);
    const w = r.canvas.width;
    const h = r.canvas.height;
    return { w, h, rgba: base64(r.ctx.getImageData(0, 0, w, h).data) };
  },
  async songOffline(): Promise<{ all: ReturnType<typeof stats>; a440: number; tail: ReturnType<typeof stats> }> {
    const all = await renderSongOffline('test/all', 3.5);
    const a = await renderSongOffline('test/a440', 2);
    if (!all || !a) throw new Error('offline render returned null');
    return {
      all: stats(all),
      a440: pitch(a, 22050, 4096),
      tail: stats(all, Math.floor(all.length * 0.95)),
    };
  },
  /** Present the opaque scene on a visible canvas and check the scaled image block by block. */
  async display(): Promise<{ scale: number; w: number; h: number; mismatches: number; letterbox: number[]; scanDarker: boolean }> {
    document.body.style.margin = '0';
    const c = document.createElement('canvas');
    document.body.appendChild(c);
    const d = createDisplay(c);
    const r = new CanvasRenderer();
    drawOpaqueScene(r);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    d.present(r.canvas);
    const s = d.scale;
    const ox = Math.floor((c.width - r.w * s) / 2);
    const oy = Math.floor((c.height - r.h * s) / 2);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const vis = ctx.getImageData(0, 0, c.width, c.height).data;
    const back = r.ctx.getImageData(0, 0, r.w, r.h).data;
    let mismatches = 0;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        // Check two opposite corners of every block: scaling must be crisp.
        for (const [dx, dy] of [[0, 0], [s - 1, s - 1]]) {
          const vi = ((oy + y * s + dy) * c.width + ox + x * s + dx) * 4;
          const bi = (y * r.w + x) * 4;
          if (vis[vi] !== back[bi] || vis[vi + 1] !== back[bi + 1] || vis[vi + 2] !== back[bi + 2]) mismatches++;
        }
      }
    }
    const letterbox = Array.from(vis.slice(0, 4));
    d.setScanlines(true);
    d.present(r.canvas);
    const top = ctx.getImageData(ox + 10 * s, oy + 100 * s, 1, 1).data;
    const bottom = ctx.getImageData(ox + 10 * s, oy + 100 * s + s - 1, 1, 1).data;
    const scanDarker = s < 2 || bottom[0] + bottom[1] + bottom[2] < top[0] + top[1] + top[2];
    d.destroy();
    c.remove();
    return { scale: s, w: c.width, h: c.height, mismatches, letterbox, scanDarker };
  },
  /**
   * The display picks the backbuffer resolution for its scale; a res-k backbuffer is presented
   * as crisp (scale / k)-sized blocks (1:1 when res = scale).
   */
  /**
   * Present the opaque scene drawn at the display's resolution for `mode` and check that the
   * device pixel at the centre of every backbuffer pixel shows it (any ratio s / k), and that
   * every logical pixel edge falls on a whole device pixel (the rect blocks stay even).
   */
  async displayHires(mode: UpscaleMode): Promise<{ scale: number; res: number; back: number[]; mismatches: number; uneven: number }> {
    document.body.style.margin = '0';
    const c = document.createElement('canvas');
    document.body.appendChild(c);
    const d = createDisplay(c);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const k = d.resFor(upscaleFactor(mode));
    const r = new CanvasRenderer(undefined, undefined, undefined, { res: k, mode });
    drawOpaqueScene(r);
    d.present(r.canvas);
    const s = d.scale;
    const bw = r.canvas.width;
    const bh = r.canvas.height;
    const ox = Math.floor((c.width - r.w * s) / 2);
    const oy = Math.floor((c.height - r.h * s) / 2);
    const vis = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, c.width, c.height).data;
    const back = r.ctx.getImageData(0, 0, bw, bh).data;
    const same = (vi: number, bi: number): boolean => vis[vi] === back[bi] && vis[vi + 1] === back[bi + 1] && vis[vi + 2] === back[bi + 2];
    let mismatches = 0;
    for (let y = 0; y < bh; y++) {
      const dy = oy + Math.floor(((y + 0.5) * s) / k);
      for (let x = 0; x < bw; x++) {
        const vi = (dy * c.width + ox + Math.floor(((x + 0.5) * s) / k)) * 4;
        if (!same(vi, (y * bw + x) * 4)) mismatches++;
      }
    }
    // A logical pixel that is one colour in the backbuffer is one colour on all its s × s
    // device pixels: the first and last device pixel of each such block match its colour.
    let uneven = 0;
    for (let ly = 0; ly < r.h; ly++) {
      for (let lx = 0; lx < r.w; lx++) {
        const bi = (ly * k * bw + lx * k) * 4;
        let flat = true;
        for (let j = 0; j < k && flat; j++) for (let i = 0; i < k && flat; i++) flat = back[((ly * k + j) * bw + lx * k + i) * 4] === back[bi] && back[((ly * k + j) * bw + lx * k + i) * 4 + 1] === back[bi + 1] && back[((ly * k + j) * bw + lx * k + i) * 4 + 2] === back[bi + 2];
        if (!flat) continue;
        for (const [dx, dy] of [[0, 0], [s - 1, s - 1]]) {
          if (!same(((oy + ly * s + dy) * c.width + ox + lx * s + dx) * 4, bi)) uneven++;
        }
      }
    }
    d.destroy();
    c.remove();
    return { scale: s, res: k, back: [bw, bh], mismatches, uneven };
  },
  async liveAudio(): Promise<{ state: string; unlocked: boolean }> {
    const out = new WebAudioOut({ autoUnlock: false, autoSuspend: false, speech: false });
    out.music('test/all');
    const ctx = await unlock();
    for (let i = 0; i < 30; i++) out.sfx(i % 2 === 0 ? 'ui/move' : 'ui/confirm', { pitch: 1 + i / 30, pan: (i % 3) - 1 });
    out.sfx('missing/sound');
    out.voice('MISSION START');
    await new Promise((r) => setTimeout(r, 300));
    out.pauseMusic();
    await new Promise((r) => setTimeout(r, 100));
    out.resumeMusic();
    out.setVolume('music', 0.3);
    out.music('test/a440', { fadeTicks: 12 });
    await new Promise((r) => setTimeout(r, 300));
    out.music(null, { fadeTicks: 6 });
    out.setMuted(true);
    out.stopAll();
    return { state: ctx?.state ?? 'none', unlocked: out.unlocked };
  },
  /**
   * Samples (docs/api/media.md §9.5): a group of generated WAV files (served by a fake fetch)
   * replaces the synth song, a sound effect and an announcer line; the voice sample ducks the
   * music; pause / resume / stopAll work on the sample player.
   */
  async samples(): Promise<{ before: string | null; after: string | null; sfx: boolean; voiceReady: boolean; ducked: number; speaking: boolean; resumed: boolean; afterStop: boolean; silentDuck: number; silentSpeech: boolean }> {
    const wav = (seconds: number, freq: number): ArrayBuffer => {
      const rate = 22050;
      const n = Math.floor(seconds * rate);
      const buf = new ArrayBuffer(44 + n * 2);
      const v = new DataView(buf);
      const str = (o: number, s: string): void => {
        for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
      };
      str(0, 'RIFF');
      v.setUint32(4, 36 + n * 2, true);
      str(8, 'WAVEfmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, rate, true);
      v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      str(36, 'data');
      v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000), true);
      return buf;
    };
    const files: Record<string, ArrayBuffer> = { 'song.wav': wav(3, 220), 'move.wav': wav(0.1, 880), 'line.wav': wav(1, 440) };
    defineSampleGroup('test:samples', {
      music: { 'test/all': { file: 't/song.wav', loopStart: 1, loopEnd: 2.5, duration: 3 } },
      sfx: { 'ui/move': { files: ['t/move.wav'], vol: 0.8 } },
      voice: { [voiceKey('MISSION START')]: { files: ['t/line.wav'], duration: 1 } },
    });
    const out = new WebAudioOut({
      autoUnlock: false,
      autoSuspend: false,
      speech: false,
      samples: {
        baseUrl: 'http://media.test/',
        fetch: (url) => {
          const f = files[url.split('/').pop() ?? ''];
          return Promise.resolve({ ok: !!f, status: f ? 200 : 404, arrayBuffer: () => Promise.resolve(f.slice(0)) });
        },
      },
    });
    await unlock();
    out.music('test/all');
    const before = out.songSource;
    await out.loadSamples('test:samples');
    const after = out.songSource;
    out.sfx('ui/move');
    const sfx = out.samples.state('sfx', 'ui/move') === 'ready';
    const voiceReady = out.samples.state('voice', 'mission-start') === 'ready';
    out.voice('MISSION START');
    await new Promise((r) => setTimeout(r, 200));
    const duck = (out as unknown as { dialogueDuck: GainNode }).dialogueDuck.gain.value;
    const speaking = (out as unknown as { speech: unknown }).speech !== null;
    out.pauseMusic();
    await new Promise((r) => setTimeout(r, 60));
    out.music('test/all');
    const song = (out as unknown as { song: { paused: boolean } | null }).song;
    const resumed = song !== null && !song.paused;
    out.stopAll();
    const afterStop = (out as unknown as { speech: unknown }).speech === null;
    // VOICE VOLUME 0: the line is not started and the music is not ducked.
    out.music('test/all');
    out.setVolume('voice', 0);
    out.voice('MISSION START');
    await new Promise((r) => setTimeout(r, 150));
    const silentDuck = (out as unknown as { dialogueDuck: GainNode }).dialogueDuck.gain.value;
    const silentSpeech = (out as unknown as { speech: unknown }).speech !== null || out.speaking();
    out.setVolume('voice', 1);
    out.stopAll();
    out.releaseSamples('test:samples');
    return { before, after, sfx, voiceReady, ducked: duck, speaking, resumed, afterStop, silentDuck, silentSpeech };
  },
  /**
   * Music fail-soft rules: asking for a paused song again resumes it (a restarted mission), and
   * an unknown song id never stops the one that plays. Loops start and stop by key.
   */
  async musicRules(): Promise<{ resumed: boolean; kept: string | null; loops: boolean; loopPaused: number; loopResumed: number }> {
    const out = new WebAudioOut({ autoUnlock: false, autoSuspend: false, speech: false });
    await unlock();
    out.music('test/all');
    out.pauseMusic();
    out.music('test/all');
    const song = (out as unknown as { song: { paused: boolean } | null }).song;
    const resumed = song !== null && !song.paused;
    out.music('no/such-song');
    const kept = out.currentSong;
    out.sfxLoop('engine', 'ui/move', { vol: 0.5 });
    out.sfxLoop('engine', 'ui/move', { vol: 0.8 });
    const loops = (out as unknown as { loops: Map<string, unknown> }).loops.size === 1;
    // Loops fall silent under the pause menu and come back on resume.
    const loopBus = (out as unknown as { loopBus: GainNode }).loopBus;
    out.pauseLoops();
    await new Promise((r) => setTimeout(r, 250));
    const loopPaused = loopBus.gain.value;
    out.resumeLoops();
    await new Promise((r) => setTimeout(r, 350));
    const loopResumed = loopBus.gain.value;
    out.stopSfx('engine');
    out.duckMusic(0.5);
    out.stopAll();
    return { resumed, kept, loops, loopPaused, loopResumed };
  },
};

(window as unknown as { MediaTest: typeof api }).MediaTest = api;
