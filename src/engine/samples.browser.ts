import type { SampleGroup, SampleSfx, SampleSong, SampleVoice } from './samples';
import { getSampleGroup, pickTake } from './samples';

/**
 * Sample bank (docs/api/media.md §9.5): fetches and decodes the files of a sample group and hands
 * the Web Audio output a decoded take per sound effect id, song id or voice key.
 *
 * - Files are fetched from `audio/<file>` next to the page (`document.baseURI`, so the Vite
 *   `base: './'` build works from any folder). Fetching needs no AudioContext.
 * - Decoding uses the shared AudioContext once it exists; before the first user gesture it uses
 *   an OfflineAudioContext, so the boot scene can finish the start-screen samples before the
 *   first click (an AudioBuffer is not tied to the context that decoded it).
 * - Every key is 'loading', 'ready' (at least one take decoded) or 'failed'. A failed file warns
 *   once and the synth keeps playing that id.
 * - Takes are picked at random (Math.random: cosmetic, browser only) and never twice in a row.
 *
 * Memory: decoded audio is 32-bit float PCM, about 21 MB per minute of stereo at 44.1 kHz (a
 * 60 s song is about 21 MB; a 1 s sound about 0.35 MB). `release(group)` drops a group's buffers;
 * a key that another loaded group also lists stays.
 */

export type SampleKind = 'sfx' | 'music' | 'voice';
export type SampleState = 'loading' | 'ready' | 'failed';

/** Decodes encoded bytes (MP3) into an AudioBuffer. */
export type SampleDecoder = (bytes: ArrayBuffer) => Promise<AudioBuffer>;

export interface SampleBankDeps {
  /** Base URL that `audio/<file>` resolves against (default `document.baseURI`). */
  baseUrl?: string;
  fetch?: (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
  /** Decoder (default: the shared AudioContext when it exists, else an OfflineAudioContext). */
  decode?: SampleDecoder;
  /** Parallel downloads (default 6). */
  parallel?: number;
  random?: () => number;
  warn?: (msg: string) => void;
}

interface Entry<D> {
  def: D;
  state: SampleState;
  takes: AudioBuffer[];
  last: number;
  /** Groups that list this key. */
  owners: Set<string>;
}

export interface SfxTake {
  buffer: AudioBuffer;
  def: SampleSfx;
}

export interface SongTake {
  buffer: AudioBuffer;
  def: SampleSong;
}

export interface VoiceTake {
  buffer: AudioBuffer;
  def: SampleVoice;
}

let offline: OfflineAudioContext | null = null;

/** The default decoder: `ctx()` (the live context) when it exists, else a shared OfflineAudioContext. */
export function defaultDecoder(ctx: () => BaseAudioContext | null): SampleDecoder {
  return (bytes) => {
    let c = ctx();
    if (!c) {
      if (!offline) {
        const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
        const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
        if (!Ctor) return Promise.reject(new Error('no OfflineAudioContext'));
        offline = new Ctor(2, 1, 44100);
      }
      c = offline;
    }
    const target = c;
    // The callback form also works in older Safari, where decodeAudioData returns no promise.
    return new Promise<AudioBuffer>((resolve, reject) => {
      const p = target.decodeAudioData(bytes, resolve, (e) => reject(e ?? new Error('decode failed')));
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  };
}

export class SampleBank {
  private readonly sfxs = new Map<string, Entry<SampleSfx>>();
  private readonly songs = new Map<string, Entry<SampleSong>>();
  private readonly voices = new Map<string, Entry<SampleVoice>>();
  private readonly loads = new Map<string, Promise<void>>();
  private readonly warned = new Set<string>();
  private readonly deps: SampleBankDeps;
  private readonly decoder: SampleDecoder;

  constructor(decoder: SampleDecoder, deps: SampleBankDeps = {}) {
    this.decoder = deps.decode ?? decoder;
    this.deps = deps;
  }

  /**
   * Fetch and decode every file of a group (once; later calls return the same promise). Never
   * rejects: failures warn and leave the synth in place. `onProgress(done, total)` counts files.
   * A group that is not registered (content not loaded, or no samples) resolves at once.
   */
  load(group: string, onProgress?: (done: number, total: number) => void): Promise<void> {
    const running = this.loads.get(group);
    if (running) return running;
    const g = getSampleGroup(group);
    if (!g) return Promise.resolve();
    const p = this.fetchGroup(group, g, onProgress);
    this.loads.set(group, p);
    return p;
  }

  /** Drop the decoded buffers of a group (keys another loaded group lists stay). */
  release(group: string): void {
    this.loads.delete(group);
    for (const map of [this.sfxs, this.songs, this.voices] as Map<string, Entry<unknown>>[]) {
      for (const [key, e] of map) {
        if (!e.owners.delete(group)) continue;
        if (e.owners.size === 0) map.delete(key);
      }
    }
  }

  state(kind: SampleKind, key: string): SampleState | null {
    return this.map(kind).get(key)?.state ?? null;
  }

  /** The manifest entry of a sound effect when a take is ready (no take is picked), else null. */
  sfxDef(id: string): SampleSfx | null {
    const e = this.sfxs.get(id);
    return e && e.state === 'ready' && e.takes.length > 0 ? e.def : null;
  }

  /** A random take of a sound effect, or null when none is ready. */
  sfx(id: string): SfxTake | null {
    const e = this.sfxs.get(id);
    const buffer = e && this.take(e);
    return e && buffer ? { buffer, def: e.def } : null;
  }

  song(id: string): SongTake | null {
    const e = this.songs.get(id);
    const buffer = e && this.take(e);
    return e && buffer ? { buffer, def: e.def } : null;
  }

  voice(key: string): VoiceTake | null {
    const e = this.voices.get(key);
    const buffer = e && this.take(e);
    return e && buffer ? { buffer, def: e.def } : null;
  }

  /** Keys of a kind that are ready (tests, tools). */
  ready(kind: SampleKind): string[] {
    return [...this.map(kind)].filter(([, e]) => e.state === 'ready').map(([k]) => k);
  }

  // ------------------------------------------------------------------ internals

  private map(kind: SampleKind): Map<string, Entry<unknown>> {
    return (kind === 'sfx' ? this.sfxs : kind === 'music' ? this.songs : this.voices) as Map<string, Entry<unknown>>;
  }

  private take(e: Entry<unknown>): AudioBuffer | null {
    const n = e.takes.length;
    if (e.state !== 'ready' || n === 0) return null;
    const i = pickTake(n, e.last, (this.deps.random ?? Math.random)());
    e.last = i;
    return e.takes[i];
  }

  private async fetchGroup(group: string, g: SampleGroup, onProgress?: (done: number, total: number) => void): Promise<void> {
    const jobs: Array<{ entry: Entry<unknown>; file: string }> = [];
    const add = <D>(map: Map<string, Entry<D>>, key: string, def: D, files: readonly string[]): void => {
      let e = map.get(key);
      if (e && e.def === def) {
        e.owners.add(group);
        return;
      }
      e = { def, state: 'loading', takes: [], last: -1, owners: new Set([group]) };
      map.set(key, e);
      if (files.length === 0) e.state = 'failed';
      for (const file of files) jobs.push({ entry: e as Entry<unknown>, file });
    };
    for (const [id, d] of Object.entries(g.sfx ?? {})) add(this.sfxs, id, d, d.files);
    for (const [id, d] of Object.entries(g.music ?? {})) add(this.songs, id, d, [d.file]);
    for (const [key, d] of Object.entries(g.voice ?? {})) add(this.voices, key, d, d.files);

    const total = jobs.length;
    let done = 0;
    const pending = new Map<Entry<unknown>, number>();
    for (const j of jobs) pending.set(j.entry, (pending.get(j.entry) ?? 0) + 1);
    onProgress?.(0, total);
    const settle = (e: Entry<unknown>): void => {
      const left = (pending.get(e) ?? 1) - 1;
      pending.set(e, left);
      if (left === 0) e.state = e.takes.length > 0 ? 'ready' : 'failed';
    };
    const run = async (j: { entry: Entry<unknown>; file: string }): Promise<void> => {
      try {
        const buf = await this.decoder(await this.bytes(j.file));
        // A release during the load drops the entry: do not revive it.
        if (j.entry.owners.size > 0) j.entry.takes.push(buf);
      } catch (err) {
        this.warnOnce(j.file, `[samples] cannot load "${j.file}" (the synth plays instead): ${String(err)}`);
      }
      settle(j.entry);
      done++;
      onProgress?.(done, total);
    };
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < jobs.length) await run(jobs[next++]);
    };
    const n = Math.max(1, Math.min(jobs.length, this.deps.parallel ?? 6));
    await Promise.all(Array.from({ length: n }, worker));
  }

  private async bytes(file: string): Promise<ArrayBuffer> {
    const base = this.deps.baseUrl ?? document.baseURI;
    const url = new URL(`audio/${file}`, base).href;
    const f = this.deps.fetch ?? ((u: string) => fetch(u));
    const res = await f(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  private warnOnce(key: string, msg: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    (this.deps.warn ?? console.warn)(msg);
  }
}
