import type { AudioOut, EchoOpts, EngineOpts, EngineParams, MusicOpts, RadioOpts, RadioParams, SfxOpts, SongSource, SongState, VolumeKind } from './audio';
import { engineParams, engineSteal, loopPanGain, RADIO_NEUTRAL, radioParams } from './audio';
import type { InstrumentDef, InstrumentEnv, ParsedSong, ScheduledNote } from './music';
import { getSong, midiToFreq, orderTime, rowTime, songError, songEvents, songLength } from './music';
import type { SampleBankDeps, SongTake, StreamTake } from './samples.browser';
import { defaultDecoder, SampleBank } from './samples.browser';
import type { SayOpts, SpeechItem, SpeechKind } from './samples';
import { foldLoopPosition, songLoopEnd, SpeechLane, voiceKey } from './samples';
import { getSfxRecipe, jitterPitch, renderSfx, SAMPLE_RATE, sfxJitter, sfxLimits } from './synth';
import type { Announcer } from './voice.browser';
import { createAnnouncer } from './voice.browser';

/**
 * Web Audio output (docs/ARCHITECTURE.md §5.7, docs/api/media.md §9.3).
 *
 * - One shared AudioContext, created and resumed on the first user gesture (`unlock()` /
 *   `installUnlockHook()`; WebAudioOut installs the hook by default). Calls made before that
 *   are dropped, except the last music request, which starts on unlock.
 * - Graph: sfx / music / voice buses → master gain → gentle compressor → speakers.
 * - Sound effects play pre-rendered synth buffers (cached AudioBuffers) with per-id and global
 *   voice limits, a minimum gap between starts, pitch via playbackRate and stereo panning.
 * - Music: a look-ahead scheduler (25 ms timer, ~120 ms horizon) turns the pure song events of
 *   music.ts into oscillator / buffer nodes at exact times, so loops are seamless. Songs fade
 *   in and out, can pause and resume.
 * - Samples (samples.ts, docs/api/media.md §9.5): a loaded sample group skins existing ids. A
 *   sound effect plays a random sampled take (same voice limits, gap, pitch, jitter, volume and
 *   pan); a song plays its file (intro, then a seamless loop between its loop points); a voice
 *   line plays its sample on the voice bus with the music ducked under it. Missing, loading or
 *   failed samples fall back to the synth (sfx, music), the speech announcer (`voice`) or
 *   silence (`say`).
 * - Rally wave C opt-ins (audio.ts; nothing else calls them): a song-end event and a song state
 *   query (`onSongEnd`, `songState`, `MusicOpts.once`); STREAMED songs (`SampleSong.stream`: a media
 *   element source on the music bus, no full decode; the dialogue duck applies); the car radio's
 *   chain on the music + voice buses (`setRadio`: speaker band-pass, tunnel muffle, signal, static);
 *   parametric engine voices (`engine` / `stopEngine`, at most ENGINE_VOICES); pan on loops.
 */

let sharedCtx: AudioContext | null = null;
const onContext = new Set<(ctx: AudioContext) => void>();

/** The shared AudioContext, or null before the first unlock. */
export function getAudioContext(): AudioContext | null {
  return sharedCtx;
}

/** Create (once) and resume the shared AudioContext. Call it from a user-gesture handler. */
export function unlock(): Promise<AudioContext | null> {
  try {
    if (!sharedCtx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return Promise.resolve(null);
      sharedCtx = new Ctor({ latencyHint: 'interactive' });
      const ctx = sharedCtx;
      for (const fn of onContext) fn(ctx);
    }
    const ctx = sharedCtx;
    if (ctx.state === 'suspended') return ctx.resume().then(() => ctx, () => ctx);
    return Promise.resolve(ctx);
  } catch (err) {
    console.warn('[audio] cannot start Web Audio:', err);
    return Promise.resolve(null);
  }
}

const GESTURES = ['pointerdown', 'mousedown', 'keydown', 'touchend'] as const;

/** Unlock audio on the first pointer / key / touch gesture. Returns an uninstall function. */
export function installUnlockHook(target: EventTarget = window): () => void {
  const handler = (): void => {
    void unlock().then((ctx) => {
      if (ctx?.state === 'running') uninstall();
    });
  };
  const uninstall = (): void => {
    for (const e of GESTURES) target.removeEventListener(e, handler, true);
  };
  for (const e of GESTURES) target.addEventListener(e, handler, true);
  return uninstall;
}

export interface WebAudioOpts {
  /** Unlock on the first user gesture (default true). */
  autoUnlock?: boolean;
  /** Suspend while the tab is hidden (default true). */
  autoSuspend?: boolean;
  /** Use speech synthesis for voice() (default true); otherwise a jingle plays. */
  speech?: boolean;
  /** Global limit of simultaneous sound effects (default 24). */
  maxVoices?: number;
  /** Initial volumes 0..1. */
  volumes?: Partial<Record<VolumeKind, number>>;
  /** Sample bank options (base URL, fetch, decoder; tests). */
  samples?: SampleBankDeps;
}

interface ActiveSfx {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
  end: number;
}

/** A looping sound (`sfxLoop`): `mul` = the sample's level match, `panMul` = the pan's level match. */
interface LoopEntry {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
  mul: number;
  vol: number;
  /** Where the loop goes (the loop bus). */
  out: AudioNode;
  /** Inserted by the first pan (rally wave C). */
  panner: StereoPannerNode | null;
  panMul: number;
  mono: boolean;
}

/** Can this context stream a song through a media element (a live AudioContext in a page)? */
function canStream(ctx: BaseAudioContext): boolean {
  return typeof (ctx as AudioContext).createMediaElementSource === 'function' && typeof Audio === 'function';
}

/** `seconds` of white noise (mono, cosmetic: Math.random). */
function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.round(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);
/** A manifest gain multiplier (level match), 0..4. */
const gainOf = (v: number | undefined): number => (v === undefined || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(4, v)));

/** Music level while a voice sample speaks (dialogue ducking). */
const DIALOGUE_DUCK = 0.4;
/** A song whose sample finishes loading within this many seconds of its synth start swaps at the same position. */
const HOT_SWAP_SAME_POS = 3;

export class WebAudioOut implements AudioOut {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<'music' | 'sfx' | 'voice', GainNode> | null = null;
  private readonly vols: Record<VolumeKind, number> = { master: 0.8, music: 0.6, sfx: 0.8, voice: 1 };
  private muted = false;
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private active: ActiveSfx[] = [];
  private readonly lastStart = new Map<string, number>();
  private song: MusicPlayer | null = null;
  private wanted: { id: string | null; opts?: MusicOpts } | null = null;
  /** Looping sounds by key (sfxLoop / stopSfx); `mul` is the sample's level match. */
  private readonly loops = new Map<string, LoopEntry>();
  /** Song-end listeners (`onSongEnd`). */
  private readonly songEnd = new Set<(id: string) => void>();
  /** The reused `songState` object. */
  private readonly state: SongState = { id: '', source: 'synth', position: 0, duration: 0, ended: false, paused: false };
  /** The car radio's chain (`setRadio`; built on its first use) and the wanted settings. */
  private radio: RadioChain | null = null;
  private radioWanted: RadioOpts | null = null;
  /** Engine voices by key (`engine`). */
  private readonly engines = new Map<string, EngineVoice>();
  private readonly engineP = {} as EngineParams;
  /** One second of white noise (the engines' exhaust, the radio's static), made on first use. */
  private noise: AudioBuffer | null = null;
  private duck = 1;
  /** Decoded sample groups (samples.ts); empty until `loadSamples`. */
  readonly samples: SampleBank;
  /** Sound effect id → the sampled id that plays for it (itself, or the id it aliases), or null. */
  private readonly sampleIds = new Map<string, string | null>();
  /** Music ducking under voice samples: between the music bus and the master gain. */
  private dialogueDuck: GainNode | null = null;
  /** Every looping sound goes through this gain into the sfx bus (`pauseLoops` silences it). */
  private loopBus: GainNode | null = null;
  /** The opt-in echo send of the sfx bus (`setEcho`; built on its first use) and the wanted one. */
  private echo: { delay: DelayNode; fb: GainNode; wet: GainNode } | null = null;
  private echoWanted: EchoOpts | null = null;
  private loopsPaused = false;
  /** The one speech channel of the voice samples and the line that sounds. */
  private readonly lane = new SpeechLane();
  private speech: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private readonly announcer: Announcer;
  private readonly useSpeech: boolean;
  private readonly maxVoices: number;
  private readonly warned = new Set<string>();

  constructor(opts: WebAudioOpts = {}) {
    this.maxVoices = Math.max(1, opts.maxVoices ?? 24);
    this.useSpeech = opts.speech !== false;
    this.announcer = createAnnouncer();
    this.samples = new SampleBank(defaultDecoder(() => this.ctx), opts.samples);
    for (const [k, v] of Object.entries(opts.volumes ?? {})) this.vols[k as VolumeKind] = clamp01(v);
    if (sharedCtx) this.attach(sharedCtx);
    else onContext.add(this.attach);
    if (opts.autoUnlock !== false) installUnlockHook();
    if (opts.autoSuspend !== false && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.suspend();
        else this.resume();
      });
    }
  }

  /**
   * The opt-in echo of the sound effects (AudioOut.setEcho): the sfx bus feeds a delay with
   * feedback into the master gain. Built on the first call; null fades the wet level to 0.
   */
  setEcho(o: EchoOpts | null): void {
    this.echoWanted = o;
    const ctx = this.ctx;
    if (!ctx || !this.buses || !this.master || (!o && !this.echo)) return;
    if (!this.echo) {
      const delay = ctx.createDelay(1);
      const fb = ctx.createGain();
      const wet = ctx.createGain();
      fb.gain.value = 0;
      wet.gain.value = 0;
      this.buses.sfx.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
      this.echo = { delay, fb, wet };
    }
    const e = this.echo;
    const now = ctx.currentTime;
    if (o) e.delay.delayTime.setValueAtTime(Math.max(0.01, Math.min(1, o.delay)), now);
    e.fb.gain.setTargetAtTime(o ? Math.max(0, Math.min(0.9, o.feedback)) : 0, now, 0.05);
    e.wet.gain.setTargetAtTime(o ? clamp01(o.mix) : 0, now, 0.08);
  }

  /** True once the AudioContext exists and runs. */
  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  private readonly attach = (ctx: AudioContext): void => {
    if (this.ctx) return;
    this.ctx = ctx;
    onContext.delete(this.attach);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    const bus = (): GainNode => {
      const g = ctx.createGain();
      g.connect(this.master as GainNode);
      return g;
    };
    // Music → dialogue duck → master; the duck is separate from the pause duck (`duckMusic`), so
    // the two multiply and never overwrite each other's automation.
    this.dialogueDuck = ctx.createGain();
    this.dialogueDuck.connect(this.master);
    const music = ctx.createGain();
    music.connect(this.dialogueDuck);
    this.buses = { music, sfx: bus(), voice: bus() };
    this.loopBus = ctx.createGain();
    this.loopBus.gain.value = this.loopsPaused ? 0 : 1;
    this.loopBus.connect(this.buses.sfx);
    this.applyVolumes(true);
    if (this.echoWanted) this.setEcho(this.echoWanted);
    if (this.radioWanted) this.setRadio(this.radioWanted);
    // A song requested while the context was missing or suspended starts once it runs.
    ctx.addEventListener('statechange', this.flushWanted);
    this.flushWanted();
  };

  private readonly flushWanted = (): void => {
    const w = this.wanted;
    if (!w || this.ctx?.state !== 'running') return;
    this.wanted = null;
    this.music(w.id, w.opts);
  };

  // ------------------------------------------------------------------ sfx

  sfx(id: string, o?: SfxOpts): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses || ctx.state !== 'running') return;
    this.play(id, this.buses.sfx, o);
  }

  /** Render (and cache) sound buffers ahead of time to avoid a hitch on first use. */
  preload(ids: readonly string[]): void {
    for (const id of ids) renderSfx(id);
    if (this.ctx) for (const id of ids) this.buffer(id);
  }

  private play(id: string, bus: GainNode, o?: SfxOpts): void {
    const ctx = this.ctx as AudioContext;
    // A sampled take when the id (or the id it aliases) has one, else the synth buffer.
    const sid = this.sampleId(id);
    const def = sid ? this.samples.sfxDef(sid) : null;
    if (!def && !this.buffer(id)) return;
    const now = ctx.currentTime;
    const synth = sfxLimits(id);
    const lim = { voices: Math.max(1, def?.voices ?? synth.voices), gap: Math.max(0, def?.gap ?? synth.gap) };
    const last = this.lastStart.get(id);
    if (last !== undefined && now - last < lim.gap) return;
    const take = sid ? this.samples.sfx(sid) : null;
    const buf = take?.buffer ?? this.buffer(id);
    if (!buf) return;
    this.prune(now);
    let count = 0;
    let oldest = -1;
    for (let i = 0; i < this.active.length; i++) {
      if (this.active[i].id !== id) continue;
      count++;
      if (oldest < 0) oldest = i;
    }
    if (count >= lim.voices && oldest >= 0) this.kill(oldest, now);
    if (this.active.length >= this.maxVoices) this.kill(0, now);

    // Jitter (recipe `jitter`): a cosmetic random pitch change per play, not the simulation rng.
    const pitch = Math.max(0.1, Math.min(4, jitterPitch(o?.pitch ?? 1, sfxJitter(id), Math.random())));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const gain = ctx.createGain();
    gain.gain.value = clamp01(o?.vol ?? 1) * gainOf(take?.def.vol);
    src.connect(gain);
    const pan = o?.pan ?? 0;
    let panner: StereoPannerNode | null = null;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(bus);
    } else {
      gain.connect(bus);
    }
    const entry: ActiveSfx = { id, src, gain, end: now + buf.duration / pitch };
    src.onended = (): void => {
      const i = this.active.indexOf(entry);
      if (i >= 0) this.active.splice(i, 1);
      gain.disconnect();
      panner?.disconnect();
    };
    src.start(now);
    this.active.push(entry);
    this.lastStart.set(id, now);
  }

  /**
   * The sampled id that plays for a sound effect id: the id itself when its sample is ready, else
   * an id with a ready sample and the same synth recipe (an alias such as 'boss/warning' →
   * 'ui/warning'), else null. Cached; the cache resets when a group loads or is released.
   */
  private sampleId(id: string): string | null {
    if (this.samples.state('sfx', id) === 'ready') return id;
    let sid = this.sampleIds.get(id);
    if (sid === undefined) {
      const r = getSfxRecipe(id);
      sid = (r && this.samples.ready('sfx').find((k) => getSfxRecipe(k) === r)) || null;
      this.sampleIds.set(id, sid);
    }
    return sid;
  }

  /** The synth buffer of a sound effect id (rendered once, cached). */
  private buffer(id: string): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (this.buffers.has(id)) return this.buffers.get(id) ?? null;
    const samples = renderSfx(id);
    let buf: AudioBuffer | null = null;
    if (samples && samples.length > 0) {
      buf = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
      buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    }
    this.buffers.set(id, buf);
    return buf;
  }

  /** Stop instance i with a 10 ms fade (no click). */
  private kill(i: number, now: number): void {
    const e = this.active[i];
    if (!e) return;
    this.active.splice(i, 1);
    e.gain.gain.setTargetAtTime(0, now, 0.003);
    try {
      e.src.stop(now + 0.02);
    } catch {
      // already stopped
    }
  }

  private prune(now: number): void {
    if (this.active.length === 0) return;
    this.active = this.active.filter((e) => e.end > now);
  }

  // ------------------------------------------------------------------ music

  music(id: string | null, o?: MusicOpts): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses || ctx.state !== 'running') {
      this.wanted = { id, opts: o };
      return;
    }
    const fade = Math.max(0, (o?.fadeTicks ?? 0) / 60);
    const once = o?.once === true;
    if (id === null) {
      this.song?.stop(fade);
      this.song = null;
      return;
    }
    if (this.song && this.song.id === id && !o?.restart) {
      // Same song: keep it going; a song paused by the pause menu resumes (e.g. after a restart).
      if (this.song.paused) this.song.resume();
      return;
    }
    // A streamed song (rally wave C), else a loaded sample; `from` maps through its marks (else the top).
    const stream = canStream(ctx) ? this.samples.stream(id) : null;
    if (stream) {
      this.song?.stop(fade);
      this.song = new StreamPlayer(ctx as AudioContext, id, stream, this.buses.music, once, this.songEnded, this.streamFailed);
      this.song.start(fade, o?.from ? (stream.def.marks?.[o.from] ?? 0) : 0);
      return;
    }
    const take = this.samples.song(id);
    if (take) {
      this.song?.stop(fade);
      this.song = new SamplePlayer(ctx, id, take, this.buses.music, once, this.songEnded);
      this.song.start(fade, o?.from ? (take.def.marks?.[o.from] ?? 0) : 0);
      return;
    }
    const parsed = getSong(id);
    if (!parsed) {
      // Fail soft: an unknown or broken song never silences the one that is playing.
      if (!this.warned.has(id)) {
        this.warned.add(id);
        console.warn(`[music] cannot play "${id}": ${songError(id) ?? 'unknown song'}`);
      }
      return;
    }
    this.song?.stop(fade);
    this.song = new SongPlayer(ctx, id, parsed, this.buses.music, (sfxId) => this.buffer(sfxId), once, this.songEnded);
    this.song.start(fade, o?.from ? orderTime(parsed, o.from) : 0);
  }

  /** A player played to its end: tell the listeners when it is still the current song. */
  private readonly songEnded = (p: MusicPlayer): void => {
    if (this.song !== p) return;
    for (const fn of [...this.songEnd]) {
      try {
        fn(p.id);
      } catch (err) {
        console.error('[music] a song-end listener failed:', err);
      }
    }
  };

  /** A streamed song failed to load or play: the synth takes over at the same position. */
  private readonly streamFailed = (p: MusicPlayer, at: number, once: boolean): void => {
    this.samples.failStream(p.id);
    if (!this.warned.has(`stream:${p.id}`)) {
      this.warned.add(`stream:${p.id}`);
      console.warn(`[music] cannot stream "${p.id}" (the synth plays instead)`);
    }
    const ctx = this.ctx;
    if (this.song !== p || !ctx || !this.buses) return;
    const parsed = getSong(p.id);
    this.song = null;
    if (!parsed) return;
    const next = new SongPlayer(ctx, p.id, parsed, this.buses.music, (sfxId) => this.buffer(sfxId), once, this.songEnded);
    this.song = next;
    next.start(0.3, Math.min(at, songLength(parsed)));
  };

  /**
   * The current song: id, source, position (folded into its loop), length, ended, paused; null when
   * none. The returned object is reused by the next call.
   */
  songState(): SongState | null {
    const p = this.song;
    if (!p) return null;
    const st = this.state;
    st.id = p.id;
    st.source = p.source;
    st.position = p.songPosition;
    st.duration = p.duration;
    st.ended = p.finished;
    st.paused = p.paused;
    return st;
  }

  /** Listen for the end of the current song (a one-shot or a song played `once`). */
  onSongEnd(fn: (id: string) => void): () => void {
    this.songEnd.add(fn);
    return () => {
      this.songEnd.delete(fn);
    };
  }

  /** Id of the song that is loaded (playing or paused), or null. */
  get currentSong(): string | null {
    return this.song?.id ?? null;
  }

  /** 'sample' or 'synth' (or 'stream', rally wave C): what plays the current song (tests), or null. */
  get songSource(): SongSource | null {
    return this.song ? this.song.source : null;
  }

  // ------------------------------------------------------------------ samples

  /**
   * Fetch and decode a sample group (samples.ts). Never rejects; until a key is ready its synth
   * version plays. When the song that plays gets its sample, it swaps over (see `swapToSample`).
   */
  loadSamples(group: string, onProgress?: (done: number, total: number) => void): Promise<void> {
    return this.samples.load(group, onProgress).then(() => {
      this.sampleIds.clear();
      this.swapToSample();
    });
  }

  /** Drop the decoded buffers of a group (memory; a song that plays keeps its buffer). */
  releaseSamples(group: string): void {
    this.samples.release(group);
    this.sampleIds.clear();
  }

  /**
   * The synth version of a song plays and its sample is now ready (the group loaded late, e.g. a
   * skipped intro card): crossfade to the sample. Within the first seconds it continues at the
   * same position (0.3 s); later the sample starts at its loop start (1.5 s), so the intro does
   * not play twice. A one-shot that has played for a while keeps its synth version.
   */
  private swapToSample(): void {
    const ctx = this.ctx;
    const cur = this.song;
    if (!ctx || !this.buses || ctx.state !== 'running' || !(cur instanceof SongPlayer) || cur.paused || cur.ended || cur.finished) return;
    // A streamed song (rally wave C) swaps like a sample.
    const stream = canStream(ctx) ? this.samples.stream(cur.id) : null;
    const take = stream ? null : this.samples.song(cur.id);
    const def = stream?.def ?? take?.def;
    if (!def) return;
    const pos = cur.position;
    let at: number;
    let fade: number;
    if (pos < HOT_SWAP_SAME_POS) {
      at = pos;
      fade = 0.3;
    } else if (def.loopStart !== null && !cur.once) {
      at = def.loopStart;
      fade = 1.5;
    } else return;
    cur.stop(fade);
    const next: MusicPlayer = stream
      ? new StreamPlayer(ctx as AudioContext, cur.id, stream, this.buses.music, cur.once, this.songEnded, this.streamFailed)
      : new SamplePlayer(ctx, cur.id, take as SongTake, this.buses.music, cur.once, this.songEnded);
    this.song = next;
    next.start(fade, at);
  }

  // ------------------------------------------------------------------ loops & ducking

  sfxLoop(key: string, id: string, o?: SfxOpts): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses || ctx.state !== 'running') return;
    const cur = this.loops.get(key);
    const vol = clamp01(o?.vol ?? 1);
    const pitch = Math.max(0.1, Math.min(4, o?.pitch ?? 1));
    if (cur && cur.id === id) {
      // Pan (rally wave C): the first pan inserts a panner (level-matched: `loopPanGain`).
      if (o?.pan !== undefined) this.panLoop(ctx, cur, o.pan);
      cur.vol = vol;
      cur.gain.gain.setTargetAtTime(vol * cur.mul * cur.panMul, ctx.currentTime, 0.02);
      cur.src.playbackRate.setTargetAtTime(pitch, ctx.currentTime, 0.02);
      return;
    }
    if (cur) this.stopSfx(key);
    // A sampled loop between its loop points (never the raw file ends: MP3 padding), else the synth loop.
    const sid = this.sampleId(id);
    const take = sid ? this.samples.sfx(sid) : null;
    const buf = take?.buffer ?? this.buffer(id);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    if (take) {
      const ls = Math.max(0, take.def.loopStart ?? 0);
      const le = Math.min(buf.duration, take.def.loopEnd ?? buf.duration);
      if (le > ls) {
        src.loopStart = ls;
        src.loopEnd = le;
      }
    }
    src.playbackRate.value = pitch;
    const mul = gainOf(take?.def.vol);
    const gain = ctx.createGain();
    gain.gain.value = vol * mul;
    const out = this.loopBus ?? this.buses.sfx;
    src.connect(gain).connect(out);
    src.start();
    const entry: LoopEntry = { id, src, gain, mul, vol, out, panner: null, panMul: 1, mono: buf.numberOfChannels === 1 };
    this.loops.set(key, entry);
    if (o?.pan !== undefined) this.panLoop(ctx, entry, o.pan);
  }

  /** Set a loop's pan (a panner is inserted on the first call; the gain keeps the centre level). */
  private panLoop(ctx: AudioContext, e: LoopEntry, pan: number): void {
    const p = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
    if (!e.panner) {
      if (typeof ctx.createStereoPanner !== 'function') return;
      e.panner = ctx.createStereoPanner();
      e.panner.pan.value = p;
      e.gain.disconnect();
      e.gain.connect(e.panner).connect(e.out);
      e.panMul = loopPanGain(p, e.mono);
      e.gain.gain.setValueAtTime(e.vol * e.mul * e.panMul, ctx.currentTime);
      return;
    }
    e.panner.pan.setTargetAtTime(p, ctx.currentTime, 0.02);
    e.panMul = loopPanGain(p, e.mono);
  }

  pauseLoops(): void {
    this.loopsPaused = true;
    this.setLoopBus(0, 0);
    if (this.ctx) this.radio?.level(this.staticLevel(), this.ctx.currentTime);
  }

  resumeLoops(): void {
    this.loopsPaused = false;
    if (this.ctx) this.radio?.level(this.staticLevel(), this.ctx.currentTime);
    // A short delay: loops stopped together with the resume (a scene that leaves gameplay) end
    // before the bus comes back up.
    this.setLoopBus(1, 0.05);
  }

  private setLoopBus(v: number, delay: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.loopBus) return;
    const g = this.loopBus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(v, ctx.currentTime + delay, 0.03);
  }

  stopSfx(key: string, fadeTicks = 4): void {
    const cur = this.loops.get(key);
    if (!cur || !this.ctx) return;
    this.loops.delete(key);
    const now = this.ctx.currentTime;
    const f = Math.max(0.01, fadeTicks / 60);
    cur.gain.gain.setTargetAtTime(0, now, f / 3);
    try {
      cur.src.stop(now + f + 0.02);
    } catch {
      // already stopped
    }
  }

  duckMusic(factor: number): void {
    this.duck = clamp01(factor);
    this.applyVolumes(false);
  }

  // ------------------------------------------------------------------ engines (rally wave C)

  /** One second of white noise (cosmetic: Math.random), shared by the engines and the static. */
  private noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    if (!this.noise) this.noise = makeNoise(ctx, 1);
    return this.noise;
  }

  /**
   * Start or update the parametric engine voice of a key (`engineParams`; AudioParam ramps). When
   * ENGINE_VOICES sound, a new key replaces the quietest voice if it is louder (`engineSteal`).
   */
  engine(key: string, o: EngineOpts): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses || ctx.state !== 'running') return;
    const p = engineParams(o, this.engineP);
    let v = this.engines.get(key);
    if (!v) {
      const keys = [...this.engines.keys()];
      const i = engineSteal(keys.map((k) => (this.engines.get(k) as EngineVoice).level), p.gain);
      if (i < 0) return;
      if (i < keys.length) this.stopEngine(keys[i], 3);
      v = new EngineVoice(ctx, this.loopBus ?? this.buses.sfx, this.noiseBuffer(ctx), p);
      this.engines.set(key, v);
      return;
    }
    v.set(p, ctx.currentTime);
  }

  stopEngine(key: string, fadeTicks = 4): void {
    const v = this.engines.get(key);
    if (!v || !this.ctx) return;
    this.engines.delete(key);
    v.stop(this.ctx.currentTime, Math.max(0.01, fadeTicks / 60));
  }

  /** Keys of the engine voices that sound (tests). */
  get engineKeys(): string[] {
    return [...this.engines.keys()];
  }

  // ------------------------------------------------------------------ the car radio (rally wave C)

  /**
   * The car radio's chain (`radioParams`): the music bus (after the dialogue duck) and the voice bus
   * run through signal → muffle, the static joins after them, and the speaker's high-pass and
   * low-pass sit last. Built (and the buses rerouted) on the first non-null call; null ramps it to
   * neutral (flat filters, full signal, no static).
   */
  setRadio(o: RadioOpts | null): void {
    this.radioWanted = o;
    const ctx = this.ctx;
    if (!ctx || !this.buses || !this.master || !this.dialogueDuck || (!o && !this.radio)) return;
    if (!this.radio) this.radio = new RadioChain(ctx, this.dialogueDuck, this.buses.voice, this.master);
    const r = radioParams(o);
    let staticBuf: AudioBuffer | null = null;
    if (r.static > 0) {
      const sid = o?.staticId;
      const take = sid ? this.sampleId(sid) : null;
      staticBuf = (take ? this.samples.sfx(take)?.buffer : null) ?? (sid ? this.buffer(sid) : null) ?? this.noiseBuffer(ctx);
    }
    this.radio.set(r, staticBuf, this.staticLevel(), ctx.currentTime);
  }

  /** The static's level factor: the music volume and the pause duck (the static is part of the radio). */
  private staticLevel(): number {
    return this.loopsPaused ? 0 : this.vols.music * this.duck;
  }

  pauseMusic(): void {
    this.song?.pause();
  }

  resumeMusic(): void {
    this.song?.resume();
  }

  // ------------------------------------------------------------------ voice, volume, control

  voice(line: string): void {
    // VOICE VOLUME 0 (or mute): nothing to hear, so no speech, no jingle and no music duck.
    if (this.muted || this.vols.voice <= 0) return;
    if (this.speak(voiceKey(line), 'announce')) return;
    this.announcer.volume = this.muted ? 0 : this.vols.master * this.vols.voice;
    if (this.useSpeech && !this.muted && this.announcer.say(line)) return;
    const ctx = this.ctx;
    if (ctx && this.buses && ctx.state === 'running') this.play('ui/announce', this.buses.voice);
  }

  /** A speech bubble line: its voice sample, else nothing (see `SpeechLane` for what it may cut off). */
  say(text: string, speaker?: string, o?: SayOpts): void {
    if (this.muted || this.vols.voice <= 0) return;
    this.speak(voiceKey(text), 'bubble', { speaker, important: o?.important });
  }

  speaking(): boolean {
    return this.speech !== null || this.lane.playing !== null || this.lane.queued !== null;
  }

  hasVoice(text: string): boolean {
    const key = voiceKey(text);
    return (
      !this.muted &&
      this.vols.voice > 0 &&
      this.ctx !== null &&
      this.ctx.state === 'running' &&
      key !== '' &&
      this.samples.state('voice', key) === 'ready'
    );
  }

  /**
   * Route a voice sample through the speech lane (one line at a time; see `SpeechLane`). False
   * when the audio is not running or the line has no ready sample (the caller falls back).
   */
  private speak(key: string, kind: SpeechKind, o?: { speaker?: string; important?: boolean }): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.buses || ctx.state !== 'running' || !key || this.samples.state('voice', key) !== 'ready') return false;
    const action = this.lane.offer(key, kind, ctx.currentTime, o);
    if (action === 'replace') this.stopSpeech(0.04);
    if (action === 'play' || action === 'replace') this.startSpeech(this.lane.playing as SpeechItem);
    return true;
  }

  private startSpeech(item: SpeechItem): void {
    const ctx = this.ctx;
    const take = this.samples.voice(item.key);
    if (!ctx || !this.buses || !take) {
      const next = this.lane.done(ctx?.currentTime ?? 0);
      if (next) this.startSpeech(next);
      else this.releaseDuck();
      return;
    }
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = take.buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainOf(take.def.vol);
    src.connect(gain).connect(this.buses.voice);
    const cur = { src, gain };
    this.speech = cur;
    src.onended = (): void => {
      gain.disconnect();
      // A replaced or stopped line does not advance the lane.
      if (this.speech !== cur) return;
      this.speech = null;
      const next = this.lane.done(this.ctx?.currentTime ?? 0);
      if (next) this.startSpeech(next);
      else this.releaseDuck();
    };
    if (this.dialogueDuck) {
      const g = this.dialogueDuck.gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(DIALOGUE_DUCK, now, 0.03);
    }
    src.start(now);
  }

  /** Stop the voice sample that sounds (without advancing the lane). */
  private stopSpeech(fade: number): void {
    const cur = this.speech;
    const ctx = this.ctx;
    this.speech = null;
    if (!cur || !ctx) return;
    const now = ctx.currentTime;
    cur.gain.gain.setTargetAtTime(0, now, Math.max(0.001, fade / 3));
    try {
      cur.src.stop(now + fade + 0.02);
    } catch {
      // already stopped
    }
  }

  /** Bring the music back up after the last voice sample (150 ms hold). */
  private releaseDuck(now = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.dialogueDuck) return;
    const g = this.dialogueDuck.gain;
    g.cancelScheduledValues(ctx.currentTime);
    if (now) g.value = 1;
    else g.setTargetAtTime(1, ctx.currentTime + 0.15, 0.15);
  }

  setVolume(kind: VolumeKind, v: number): void {
    this.vols[kind] = clamp01(v);
    this.applyVolumes(false);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.announcer.cancel();
    this.applyVolumes(false);
  }

  private applyVolumes(now: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.buses) return;
    const set = (p: AudioParam, v: number): void => {
      if (now) p.value = v;
      else p.setTargetAtTime(v, ctx.currentTime, 0.015);
    };
    set(this.master.gain, this.muted ? 0 : this.vols.master);
    set(this.buses.music.gain, this.vols.music * this.duck);
    set(this.buses.sfx.gain, this.vols.sfx);
    set(this.buses.voice.gain, this.vols.voice);
    this.radio?.level(this.staticLevel(), ctx.currentTime);
  }

  stopAll(): void {
    const ctx = this.ctx;
    this.announcer.cancel();
    this.wanted = null;
    this.lane.clear();
    if (!ctx) return;
    this.stopSpeech(0.01);
    this.releaseDuck(true);
    const now = ctx.currentTime;
    while (this.active.length > 0) this.kill(this.active.length - 1, now);
    for (const key of [...this.loops.keys()]) this.stopSfx(key, 0);
    for (const key of [...this.engines.keys()]) this.stopEngine(key, 0);
    this.loopsPaused = false;
    this.setLoopBus(1, 0.05);
    this.song?.stop(0);
    this.song = null;
    // The car radio goes neutral (a scene that forgot `setRadio(null)` never muffles the next one).
    if (this.radio) this.setRadio(null);
    this.radioWanted = null;
  }

  suspend(): void {
    // A media element plays on while the context sleeps: hold a streamed song (hidden tab).
    if (this.song instanceof StreamPlayer) this.song.hold(true);
    void this.ctx?.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.song instanceof StreamPlayer) this.song.hold(false);
    if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  update(): void {
    // Housekeeping only; scheduling runs on its own timer.
    if (this.ctx && this.active.length > 0) this.prune(this.ctx.currentTime);
  }
}

/**
 * Render the first `seconds` of a song through the same instrument graph into an
 * OfflineAudioContext (stereo). For tests, previews and exports; null for unknown songs.
 */
export async function renderSongOffline(id: string, seconds: number, sampleRate = 44100): Promise<AudioBuffer | null> {
  const song = getSong(id);
  if (!song) return null;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  const drums = new Map<string, AudioBuffer | null>();
  const drum = (d: string): AudioBuffer | null => {
    if (!drums.has(d)) {
      const s = renderSfx(d);
      let b: AudioBuffer | null = null;
      if (s) {
        b = ctx.createBuffer(1, s.length, SAMPLE_RATE);
        b.copyToChannel(s as Float32Array<ArrayBuffer>, 0);
      }
      drums.set(d, b);
    }
    return drums.get(d) ?? null;
  };
  new SongPlayer(ctx, id, song, bus, drum).scheduleRange(0, seconds);
  return ctx.startRendering();
}

/**
 * Render an engine voice offline (tests; SFX's listening by measurement): `steps` set its opts at
 * their times (seconds; the first one starts it at 0), `seconds` long, stereo. The same nodes as
 * `WebAudioOut.engine` (`EngineVoice`), straight into the destination.
 */
export function renderEngineOffline(steps: readonly { at: number; o: EngineOpts }[], seconds: number, sampleRate = 44100): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const first = steps[0] ?? { at: 0, o: { rpm: 900, load: 0 } };
  const v = new EngineVoice(ctx, ctx.destination, makeNoise(ctx, 1), engineParams(first.o, {} as EngineParams));
  for (let i = 1; i < steps.length; i++) v.set(engineParams(steps[i].o, {} as EngineParams), Math.max(0, steps[i].at));
  return ctx.startRendering();
}

/**
 * Render `seconds` of a test input on the programme input (white noise; three sines at 60 Hz, 1 kHz
 * and 8 kHz; or silence) through the car radio's chain with `o` (null = neutral) offline (tests).
 * The static is the output's own noise; its level factor is 1 (no music volume). Stereo.
 */
export function renderRadioOffline(
  o: RadioOpts | null,
  seconds: number,
  sampleRate = 44100,
  input: 'noise' | 'tones' | 'silence' = 'noise',
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const music = ctx.createGain();
  const voice = ctx.createGain();
  music.connect(ctx.destination);
  voice.connect(ctx.destination);
  const chain = new RadioChain(ctx, music, voice, ctx.destination);
  const noise = makeNoise(ctx, 1);
  if (input === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    src.connect(g).connect(music);
    src.start(0);
  } else if (input === 'tones') {
    for (const f of [60, 1000, 8000]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.1;
      osc.connect(g).connect(music);
      osc.start(0);
    }
  }
  const r = radioParams(o);
  // Settle at once (a test reads the steady state): no ramp.
  r.ramp = 0.005;
  chain.set(r, r.static > 0 ? noise : null, 1, 0);
  return ctx.startRendering();
}

// ==================================================================== song player

const LOOKAHEAD_MS = 25;
const HORIZON = 0.12;
/** Fixed mix headroom so dense songs (6–8 channels) stay below full scale. */
const MIX_HEADROOM = 0.7;
const waveCache = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();

/** Band-limited pulse wave of a given duty (Fourier series), cached per context. */
function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let m = waveCache.get(ctx);
  if (!m) {
    m = new Map();
    waveCache.set(ctx, m);
  }
  let w = m.get(duty);
  if (!w) {
    const n = 96;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    w = ctx.createPeriodicWave(real, imag);
    m.set(duty, w);
  }
  return w;
}

/** ADSR on a gain param. Returns when the voice can be stopped. */
function scheduleEnv(p: AudioParam, t0: number, dur: number, e: InstrumentEnv, peak: number, oneShot: boolean): number {
  const a = Math.max(0.001, e.a);
  const r = Math.max(0.01, e.r);
  p.setValueAtTime(0, t0);
  if (oneShot) {
    // Rings through attack + decay regardless of the note length.
    p.linearRampToValueAtTime(peak, t0 + a);
    p.setTargetAtTime(peak * e.s, t0 + a, Math.max(0.01, e.d / 4));
    const end = t0 + a + e.d + r;
    p.setTargetAtTime(0, t0 + a + e.d, r / 3);
    return end + r;
  }
  const tOn = Math.min(a, dur);
  p.linearRampToValueAtTime(dur < a ? peak * (dur / a) : peak, t0 + tOn);
  if (dur > a && e.d > 0) p.setTargetAtTime(peak * e.s, t0 + a, e.d / 3);
  p.setTargetAtTime(0, t0 + dur, r / 3);
  return t0 + dur + r * 2;
}

/** What `WebAudioOut.music` drives: the synth SongPlayer, a SamplePlayer or a StreamPlayer. */
interface MusicPlayer {
  readonly id: string;
  readonly source: SongSource;
  readonly paused: boolean;
  /** Played once to its end (MusicOpts.once). */
  readonly once: boolean;
  /** It played to its end (a one-shot, or `once`); `songEnded` was called. */
  readonly finished: boolean;
  /** Seconds into the song or file, folded into its loop (`songState`). */
  readonly songPosition: number;
  /** Seconds of one pass or of the file. */
  readonly duration: number;
  /** Start; `at` = seconds into the song. */
  start(fade: number, at?: number): void;
  pause(): void;
  resume(): void;
  stop(fade: number): void;
}

/** Called once when a player plays to its end (not on stop). */
type EndFn = (p: MusicPlayer) => void;

class SongPlayer implements MusicPlayer {
  readonly id: string;
  readonly source: SongSource = 'synth';
  readonly once: boolean;
  private readonly onEnd: EndFn | null;
  private endFired = false;
  private readonly ctx: BaseAudioContext;
  private readonly song: ParsedSong;
  private readonly out: GainNode;
  private readonly inputs: AudioNode[];
  private readonly drum: (id: string) => AudioBuffer | null;
  private readonly live = new Set<AudioScheduledSourceNode>();
  private readonly events: ScheduledNote[] = [];
  private startAt = 0;
  private cursor = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pausedAt: number | null = null;
  private stopped = false;

  constructor(ctx: BaseAudioContext, id: string, song: ParsedSong, bus: GainNode, drum: (id: string) => AudioBuffer | null, once = false, onEnd: EndFn | null = null) {
    this.ctx = ctx;
    this.id = id;
    this.song = song;
    this.drum = drum;
    this.once = once;
    this.onEnd = onEnd;
    this.out = ctx.createGain();
    this.out.connect(bus);
    this.inputs = song.channels.map((c) => {
      const g = ctx.createGain();
      g.gain.value = c.vol * song.vol * MIX_HEADROOM;
      if (c.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
        const p = ctx.createStereoPanner();
        p.pan.value = c.pan;
        g.connect(p);
        p.connect(this.out);
      } else {
        g.connect(this.out);
      }
      return g;
    });
  }

  /** Start playing; `at` = song time in seconds to start from (MusicOpts.from). */
  start(fade: number, at = 0): void {
    const now = this.ctx.currentTime;
    this.startAt = now + 0.05 - at;
    this.cursor = at;
    this.out.gain.setValueAtTime(fade > 0 ? 0 : 1, now);
    if (fade > 0) this.out.gain.linearRampToValueAtTime(1, now + fade);
    this.run();
  }

  private run(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = setInterval(() => this.pump(), LOOKAHEAD_MS);
    this.pump();
  }

  /** Schedule every note in [t0, t1) of song time at once (offline rendering). */
  scheduleRange(t0: number, t1: number): void {
    this.startAt = 0;
    this.out.gain.value = 1;
    this.events.length = 0;
    songEvents(this.song, t0, t1, this.events);
    for (const ev of this.events) this.note(ev);
    this.cursor = t1;
  }

  private pump(): void {
    if (this.stopped || this.pausedAt !== null) return;
    const len = songLength(this.song);
    const pos = this.ctx.currentTime - this.startAt;
    // The song-end event (rally wave C): a one-shot or a song played `once` reached its end.
    if (!this.endFired && (this.once || this.song.loopRow === null) && pos >= len) {
      this.endFired = true;
      this.onEnd?.(this);
      if (this.stopped) return;
    }
    // `once`: never schedule past one pass.
    const until = this.once ? Math.min(pos + HORIZON, len) : pos + HORIZON;
    if (until > this.cursor) {
      this.events.length = 0;
      songEvents(this.song, this.cursor, until, this.events);
      for (const ev of this.events) this.note(ev);
      this.cursor = until;
    }
    if (this.song.loopRow === null ? this.cursor > len + 3 : this.once && pos > len + 3) this.stop(0);
  }

  private note(ev: ScheduledNote): void {
    const ctx = this.ctx;
    const ch = this.song.channels[ev.ch];
    const inst = ch.inst;
    // After a throttled timer, drop notes that are clearly late instead of bunching them.
    if (this.startAt + ev.time < ctx.currentTime - 0.1) return;
    const t0 = Math.max(this.startAt + ev.time, ctx.currentTime);
    const dest = this.inputs[ev.ch];
    const peak = ev.vel * (inst.vol ?? 0.3);
    if (inst.kind === 'drums') {
      const buf = ev.drum ? this.drum(ev.drum) : null;
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = peak;
      src.connect(g).connect(dest);
      this.track(src, [g]);
      src.start(t0);
      return;
    }
    const freq = midiToFreq(ev.midi);
    const from = ev.from !== undefined ? midiToFreq(ev.from) : null;
    const amp = ctx.createGain();
    const end = scheduleEnv(amp.gain, t0, ev.dur, inst.env, peak, inst.oneShot === true);
    let head: AudioNode = amp;
    const extra: AudioNode[] = [amp];
    if (inst.filter) {
      const f = ctx.createBiquadFilter();
      f.type = inst.filter.type;
      f.Q.value = inst.filter.q ?? 0.707;
      const fEnv = inst.filter.env ?? 1;
      f.frequency.setValueAtTime(Math.min(18000, inst.filter.freq * fEnv), t0);
      if (fEnv !== 1) f.frequency.setTargetAtTime(inst.filter.freq, t0, Math.max(0.02, inst.env.d / 2));
      f.connect(amp);
      head = f;
      extra.push(f);
    }
    if (inst.tremolo && inst.tremolo.depth > 0) {
      // Gain wobbles between 1 − depth and 1.
      const d = Math.min(1, inst.tremolo.depth);
      const trem = ctx.createGain();
      trem.gain.value = 1 - d / 2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = inst.tremolo.rate;
      const lg = ctx.createGain();
      lg.gain.value = d / 2;
      lfo.connect(lg).connect(trem.gain);
      amp.connect(trem).connect(dest);
      lfo.start(t0);
      lfo.stop(end);
      extra.push(trem, lg);
      this.track(lfo, []);
    } else {
      amp.connect(dest);
    }
    const oscs = this.oscillators(inst, freq, from, ev.glide ?? 0.06, t0, end, head, extra);
    oscs.forEach((o, i) => this.track(o, i === 0 ? extra : []));
  }

  /** Creates, connects and schedules the oscillators of one voice (with an optional slide). */
  private oscillators(
    inst: InstrumentDef,
    freq: number,
    from: number | null,
    glide: number,
    t0: number,
    end: number,
    head: AudioNode,
    extra: AudioNode[],
  ): OscillatorNode[] {
    const ctx = this.ctx;
    // `ratio` scales the note frequency (FM modulator); slides glide exponentially.
    const make = (type: OscillatorType | 'pulse', ratio: number, detune: number): OscillatorNode => {
      const o = ctx.createOscillator();
      if (type === 'pulse') {
        const duty = inst.duty ?? 0.5;
        if (duty === 0.5) o.type = 'square';
        else o.setPeriodicWave(pulseWave(ctx, duty));
      } else {
        o.type = type;
      }
      if (from !== null) {
        o.frequency.setValueAtTime(from * ratio, t0);
        o.frequency.exponentialRampToValueAtTime(freq * ratio, t0 + Math.max(0.005, glide));
      } else {
        o.frequency.setValueAtTime(freq * ratio, t0);
      }
      o.detune.setValueAtTime(detune, t0);
      return o;
    };
    const oscs: OscillatorNode[] = [];
    const d = inst.detune ?? 0;
    // Plain voices: one oscillator, or two at ±detune/2 cents.
    const voice = (type: OscillatorType | 'pulse'): void => {
      oscs.push(make(type, 1, d !== 0 ? -d / 2 : 0));
      if (d !== 0) oscs.push(make(type, 1, d / 2));
    };
    switch (inst.kind) {
      case 'pulse':
        voice('pulse');
        break;
      case 'triangle':
        voice('triangle');
        break;
      case 'sine':
        voice('sine');
        break;
      case 'saw':
        voice('sawtooth');
        break;
      case 'pad': {
        const pd = inst.detune ?? 12;
        for (const k of [-1, 0, 1]) oscs.push(make('sawtooth', 1, k * pd));
        break;
      }
      case 'fm': {
        const fm = inst.fm ?? { ratio: 2, index: 2, decay: 0.5 };
        const carrier = make('sine', 1, 0);
        const mod = make('sine', fm.ratio, 0);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(fm.index * freq * fm.ratio, t0);
        depth.gain.setTargetAtTime(fm.index * freq * fm.ratio * 0.1, t0, Math.max(0.01, fm.decay / 3));
        mod.connect(depth).connect(carrier.frequency);
        extra.push(depth);
        oscs.push(carrier, mod);
        break;
      }
      case 'drums':
        break;
    }
    const level = oscs.length > 1 && inst.kind !== 'fm' ? 1 / Math.sqrt(oscs.length) : 1;
    let mix: AudioNode = head;
    if (level !== 1) {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(head);
      extra.push(g);
      mix = g;
    }
    if (inst.vibrato) {
      const v = inst.vibrato;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = v.rate;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(v.depth, t0 + v.delay + 0.15);
      lfo.connect(lg);
      for (const o of oscs) if (inst.kind !== 'fm' || o === oscs[0]) lg.connect(o.detune);
      lfo.start(t0);
      lfo.stop(end);
      extra.push(lg);
      this.track(lfo, []);
    }
    oscs.forEach((o, i) => {
      if (!(inst.kind === 'fm' && i === 1)) o.connect(mix);
      o.start(t0);
      o.stop(end);
    });
    return oscs;
  }

  /** Remember a source until it ends, then free its nodes. */
  private track(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.live.add(src);
    src.onended = (): void => {
      this.live.delete(src);
      src.disconnect();
      for (const n of nodes) n.disconnect();
    };
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  /** Stopped (by `stop`, or a one-shot that played to its end). */
  get ended(): boolean {
    return this.stopped;
  }

  get finished(): boolean {
    return this.endFired;
  }

  get duration(): number {
    return songLength(this.song);
  }

  /** The song time folded into its loop (one pass for a one-shot or `once`). */
  get songPosition(): number {
    const len = songLength(this.song);
    const loop = this.song.loopRow === null || this.once ? null : rowTime(this.song, this.song.loopRow);
    return foldLoopPosition(this.position, loop, len, len);
  }

  /** Seconds of song time played so far. */
  get position(): number {
    if (this.pausedAt !== null) return this.pausedAt;
    return Math.max(0, this.ctx.currentTime - this.startAt);
  }

  pause(): void {
    if (this.pausedAt !== null || this.stopped) return;
    const now = this.ctx.currentTime;
    this.pausedAt = Math.max(0, now - this.startAt);
    this.silence(now, 0.03);
    this.out.gain.setTargetAtTime(0, now, 0.01);
  }

  resume(): void {
    if (this.pausedAt === null || this.stopped) return;
    const now = this.ctx.currentTime;
    this.startAt = now + 0.05 - this.pausedAt;
    this.cursor = this.pausedAt;
    this.pausedAt = null;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.linearRampToValueAtTime(1, now + 0.08);
    this.run();
  }

  stop(fade: number): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    const f = Math.max(0.02, fade);
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + f);
    this.silence(now, f);
    setTimeout(() => this.out.disconnect(), (f + 0.2) * 1000);
  }

  /** Stop every scheduled or sounding source after `after` seconds. */
  private silence(now: number, after: number): void {
    for (const s of this.live) {
      try {
        s.stop(now + after);
      } catch {
        // already stopped
      }
    }
    if (this.timer !== null && this.pausedAt !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ==================================================================== sample player

/**
 * A sampled song (samples.ts `SampleSong`): one AudioBufferSourceNode plays the file; with a loop
 * (`loopStart` not null) the node loops between `loopStart` (the end of the intro) and `loopEnd`,
 * so the intro plays once and the loop is seamless. A one-shot (a jingle) ends by itself. Pause
 * remembers the position folded into the loop; resume starts a new node there. Fades work like
 * the SongPlayer's.
 */
class SamplePlayer implements MusicPlayer {
  readonly id: string;
  readonly source: SongSource = 'sample';
  readonly once: boolean;
  private readonly onEnd: EndFn | null;
  private readonly ctx: BaseAudioContext;
  private readonly take: SongTake;
  private readonly out: GainNode;
  private readonly level: number;
  private src: AudioBufferSourceNode | null = null;
  /** Context time of song position 0 for the node that plays (positions past the loop fold). */
  private t0 = 0;
  private pausedAt: number | null = null;
  private stopped = false;
  private done = false;

  constructor(ctx: BaseAudioContext, id: string, take: SongTake, bus: GainNode, once = false, onEnd: EndFn | null = null) {
    this.ctx = ctx;
    this.id = id;
    this.take = take;
    this.once = once;
    this.onEnd = onEnd;
    this.level = gainOf(take.def.vol);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(bus);
  }

  private get loopStart(): number | null {
    const ls = this.take.def.loopStart;
    return ls !== null && !this.once && this.loopEnd > ls ? Math.max(0, ls) : null;
  }

  get finished(): boolean {
    return this.done;
  }

  get duration(): number {
    return this.take.buffer.duration;
  }

  get songPosition(): number {
    return this.position;
  }

  /** Played to its end: once. */
  private end(): void {
    if (this.done) return;
    this.stopped = true;
    this.done = true;
    this.onEnd?.(this);
  }

  private get loopEnd(): number {
    return Math.min(songLoopEnd(this.take.def), this.take.buffer.duration);
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  /** File position in seconds (folded into the loop). */
  get position(): number {
    if (this.pausedAt !== null) return this.pausedAt;
    return foldLoopPosition(this.ctx.currentTime - this.t0, this.loopStart, this.loopEnd, this.take.buffer.duration);
  }

  start(fade: number, at = 0): void {
    const now = this.ctx.currentTime;
    this.out.gain.setValueAtTime(fade > 0 ? 0 : this.level, now);
    if (fade > 0) this.out.gain.linearRampToValueAtTime(this.level, now + fade);
    this.play(at, now + 0.02);
  }

  private play(at: number, when: number): void {
    const buf = this.take.buffer;
    const ls = this.loopStart;
    const offset = foldLoopPosition(at, ls, this.loopEnd, buf.duration);
    if (ls === null && offset >= buf.duration) {
      this.stopped = true;
      // Started past its end: the end event still comes (after the caller's `music` returns).
      queueMicrotask(() => this.end());
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (ls !== null) {
      src.loop = true;
      src.loopStart = ls;
      src.loopEnd = this.loopEnd;
    }
    src.connect(this.out);
    src.onended = (): void => {
      src.disconnect();
      if (this.src !== src) return;
      this.src = null;
      // A one-shot (or `once`) played to its end.
      if (this.pausedAt === null) this.end();
    };
    src.start(when, offset);
    this.src = src;
    this.t0 = when - offset;
  }

  pause(): void {
    if (this.pausedAt !== null || this.stopped) return;
    const now = this.ctx.currentTime;
    this.pausedAt = this.position;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, 0.01);
    this.halt(now + 0.05);
  }

  resume(): void {
    if (this.pausedAt === null || this.stopped) return;
    const now = this.ctx.currentTime;
    const at = this.pausedAt;
    this.pausedAt = null;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.linearRampToValueAtTime(this.level, now + 0.08);
    this.play(at, now + 0.02);
  }

  stop(fade: number): void {
    if (this.stopped && !this.src) {
      this.out.disconnect();
      return;
    }
    this.stopped = true;
    const now = this.ctx.currentTime;
    const f = Math.max(0.02, fade);
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + f);
    this.halt(now + f);
    setTimeout(() => this.out.disconnect(), (f + 0.2) * 1000);
  }

  private halt(at: number): void {
    const src = this.src;
    this.src = null;
    if (!src) return;
    try {
      src.stop(at);
    } catch {
      // already stopped
    }
  }
}

// ==================================================================== stream player (rally wave C)

/**
 * A streamed song (`SampleSong.stream`): an HTMLAudioElement through a MediaElementAudioSourceNode on
 * the music bus (so the dialogue duck, the pause duck and the radio chain apply), never decoded whole.
 * The loop: a 20 ms timer seeks back to `loopStart` at `loopEnd` (a short seek, not sample-exact; a
 * radio talks over it). `once` (or a song without a loop) plays to the file's end, then calls `onEnd`.
 * A load or decode error calls `onError` (the output falls back to the synth song).
 */
class StreamPlayer implements MusicPlayer {
  readonly id: string;
  readonly source: SongSource = 'stream';
  readonly once: boolean;
  private readonly ctx: AudioContext;
  private readonly def: StreamTake['def'];
  private readonly el: HTMLAudioElement;
  private readonly node: MediaElementAudioSourceNode;
  private readonly out: GainNode;
  private readonly level: number;
  private readonly onEnd: EndFn;
  private readonly onError: (p: MusicPlayer, at: number, once: boolean) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pausedAt: number | null = null;
  private held = false;
  private stopped = false;
  private done = false;

  constructor(
    ctx: AudioContext,
    id: string,
    take: StreamTake,
    bus: GainNode,
    once: boolean,
    onEnd: EndFn,
    onError: (p: MusicPlayer, at: number, once: boolean) => void,
  ) {
    this.ctx = ctx;
    this.id = id;
    this.def = take.def;
    this.once = once;
    this.onEnd = onEnd;
    this.onError = onError;
    this.level = gainOf(take.def.vol);
    const el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.src = take.url;
    this.el = el;
    this.node = ctx.createMediaElementSource(el);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.node.connect(this.out).connect(bus);
    el.addEventListener('ended', () => {
      if (this.stopped || this.pausedAt !== null || this.done) return;
      // A loop whose end lies at (or past) the file's end: the file ended first, so loop here.
      const ls = this.loopStart;
      if (ls !== null) {
        this.seek(ls);
        this.play();
        return;
      }
      this.done = true;
      this.stop(0);
      this.onEnd(this);
    });
    el.addEventListener('error', () => {
      if (this.stopped) return;
      const at = this.position;
      this.stop(0);
      this.onError(this, at, this.once);
    });
  }

  private get loopStart(): number | null {
    const ls = this.def.loopStart;
    return ls !== null && !this.once && this.loopEnd > ls ? Math.max(0, ls) : null;
  }

  private get loopEnd(): number {
    return songLoopEnd(this.def);
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  get finished(): boolean {
    return this.done;
  }

  get duration(): number {
    const d = this.el.duration;
    return Number.isFinite(d) && d > 0 ? d : this.def.duration;
  }

  /** The file position (the loop timer keeps it inside the loop). */
  get position(): number {
    return this.pausedAt ?? this.el.currentTime;
  }

  get songPosition(): number {
    return this.position;
  }

  start(fade: number, at = 0): void {
    const now = this.ctx.currentTime;
    this.out.gain.setValueAtTime(fade > 0 ? 0 : this.level, now);
    if (fade > 0) this.out.gain.linearRampToValueAtTime(this.level, now + fade);
    this.seek(foldLoopPosition(at, this.loopStart, this.loopEnd, this.def.duration));
    this.play();
  }

  private seek(at: number): void {
    try {
      this.el.currentTime = Math.max(0, at);
    } catch {
      // no metadata yet in an old browser: it starts at 0
    }
  }

  private play(): void {
    const p = this.el.play();
    // An abort (a stop before it started) is normal; any other refusal leaves the song silent.
    if (p) p.catch((err: unknown) => (err instanceof DOMException && err.name === 'AbortError' ? undefined : console.warn(`[music] stream "${this.id}":`, err)));
    if (this.loopStart !== null && this.timer === null) this.timer = setInterval(this.wrap, 20);
  }

  /** The loop: back to `loopStart` when the file passes `loopEnd`. */
  private readonly wrap = (): void => {
    const ls = this.loopStart;
    if (ls === null || this.stopped || this.pausedAt !== null) return;
    const t = this.el.currentTime;
    if (t >= this.loopEnd - 0.015) this.seek(ls + Math.max(0, t - this.loopEnd));
  };

  private halt(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.el.pause();
  }

  /** Hold or release the element while the context is suspended (a hidden tab). */
  hold(on: boolean): void {
    if (this.stopped || this.pausedAt !== null || on === this.held) return;
    this.held = on;
    if (on) this.halt();
    else this.play();
  }

  pause(): void {
    if (this.pausedAt !== null || this.stopped) return;
    const now = this.ctx.currentTime;
    this.pausedAt = this.el.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, 0.01);
    this.halt();
  }

  resume(): void {
    if (this.pausedAt === null || this.stopped) return;
    const now = this.ctx.currentTime;
    const at = this.pausedAt;
    this.pausedAt = null;
    this.held = false;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.linearRampToValueAtTime(this.level, now + 0.08);
    this.seek(at);
    this.play();
  }

  stop(fade: number): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    const f = Math.max(0.02, fade);
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + f);
    setTimeout(() => {
      this.el.pause();
      // Release the network stream and the decoder.
      this.el.removeAttribute('src');
      this.el.load();
      this.node.disconnect();
      this.out.disconnect();
    }, (f + 0.05) * 1000);
  }
}

// ==================================================================== engine voice (rally wave C)

/** Seconds of the AudioParam glide of an engine update (one tick at 60 Hz is 16.7 ms). */
const ENGINE_GLIDE = 0.03;

/**
 * A parametric engine (`AudioOut.engine`, `engineParams`): a sawtooth at the firing frequency, a
 * triangle at half of it (the rumble) and a square at twice it (the 2nd order) through a low-pass,
 * band-passed noise (the exhaust) and a sine whine (the turbo), then the gain and a panner (level-
 * matched in the centre: `loopPanGain`) into the loop bus. Updates glide (setTargetAtTime).
 */
class EngineVoice {
  /** The last output gain (the voice steal compares it). */
  level: number;
  private readonly oscs: OscillatorNode[];
  private readonly tone: GainNode;
  private readonly rumble: GainNode;
  private readonly harm: GainNode;
  private readonly lp: BiquadFilterNode;
  private readonly noiseSrc: AudioBufferSourceNode;
  private readonly bp: BiquadFilterNode;
  private readonly noise: GainNode;
  private readonly turbo: GainNode;
  private readonly out: GainNode;
  private readonly panner: StereoPannerNode | null;
  private readonly nodes: AudioNode[];

  constructor(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, p: EngineParams) {
    const osc = (type: OscillatorType, f: number): OscillatorNode => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      return o;
    };
    const gain = (v: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const saw = osc('sawtooth', p.fire);
    const tri = osc('triangle', p.fire / 2);
    const sq = osc('square', p.fire * 2);
    const whine = osc('sine', p.turboFreq);
    this.oscs = [saw, tri, sq, whine];
    this.tone = gain(p.tone);
    this.rumble = gain(p.rumble);
    this.harm = gain(p.harm);
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = p.cutoff;
    this.lp.Q.value = 0.9;
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = noise;
    this.noiseSrc.loop = true;
    this.bp = ctx.createBiquadFilter();
    this.bp.type = 'bandpass';
    this.bp.frequency.value = p.noiseFreq;
    this.bp.Q.value = p.noiseQ;
    this.noise = gain(p.noise);
    this.turbo = gain(p.turbo);
    this.panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    this.level = p.gain;
    // The output fades in over one glide (no click on the first update).
    this.out = gain(0);
    this.out.gain.setTargetAtTime(p.gain * (this.panner ? loopPanGain(p.pan, true) : 1), ctx.currentTime, ENGINE_GLIDE);
    saw.connect(this.tone).connect(this.lp);
    tri.connect(this.rumble).connect(this.lp);
    sq.connect(this.harm).connect(this.lp);
    this.lp.connect(this.out);
    this.noiseSrc.connect(this.bp).connect(this.noise).connect(this.out);
    whine.connect(this.turbo).connect(this.out);
    if (this.panner) {
      this.panner.pan.value = p.pan;
      this.out.connect(this.panner).connect(dest);
    } else this.out.connect(dest);
    this.nodes = [this.tone, this.rumble, this.harm, this.lp, this.bp, this.noise, this.turbo, this.out];
    if (this.panner) this.nodes.push(this.panner);
    const t = ctx.currentTime;
    for (const o of this.oscs) o.start(t);
    this.noiseSrc.start(t, Math.random() * noise.duration);
  }

  set(p: EngineParams, now: number): void {
    const g = (a: AudioParam, v: number): void => {
      a.setTargetAtTime(v, now, ENGINE_GLIDE);
    };
    const [saw, tri, sq, whine] = this.oscs;
    g(saw.frequency, p.fire);
    g(tri.frequency, p.fire / 2);
    g(sq.frequency, p.fire * 2);
    g(whine.frequency, p.turboFreq);
    g(this.tone.gain, p.tone);
    g(this.rumble.gain, p.rumble);
    g(this.harm.gain, p.harm);
    g(this.lp.frequency, p.cutoff);
    g(this.bp.frequency, p.noiseFreq);
    g(this.noise.gain, p.noise);
    g(this.turbo.gain, p.turbo);
    this.level = p.gain;
    g(this.out.gain, p.gain * (this.panner ? loopPanGain(p.pan, true) : 1));
    if (this.panner) g(this.panner.pan, p.pan);
  }

  stop(now: number, fade: number): void {
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, fade / 3);
    const end = now + fade + 0.05;
    for (const o of this.oscs) o.stop(end);
    this.noiseSrc.stop(end);
    this.oscs[0].onended = (): void => {
      for (const o of this.oscs) o.disconnect();
      this.noiseSrc.disconnect();
      for (const n of this.nodes) n.disconnect();
    };
  }
}

// ==================================================================== the car radio (rally wave C)

/**
 * The car radio's chain (`AudioOut.setRadio`): `input` (the dialogue duck's output and the voice
 * bus, rerouted from the master) → signal → muffle (low-pass) → join; the static loop → its level
 * → join; join → the speaker's high-pass → low-pass → the master. Built once; `set` ramps.
 */
class RadioChain {
  private readonly ctx: BaseAudioContext;
  private readonly signal: GainNode;
  private readonly muffle: BiquadFilterNode;
  private readonly hp: BiquadFilterNode;
  private readonly lp: BiquadFilterNode;
  private readonly staticGain: GainNode;
  private readonly join: GainNode;
  private staticSrc: AudioBufferSourceNode | null = null;
  private staticBuf: AudioBuffer | null = null;
  /** The wanted static level (0..1, before the music volume). */
  private staticWant = 0;
  private ramp = RADIO_NEUTRAL.ramp;

  constructor(ctx: BaseAudioContext, music: AudioNode, voice: AudioNode, master: AudioNode) {
    this.ctx = ctx;
    const input = ctx.createGain();
    this.signal = ctx.createGain();
    const nyq = ctx.sampleRate / 2;
    const filter = (type: BiquadFilterType, f: number): BiquadFilterNode => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = Math.min(f, nyq);
      b.Q.value = 0.707;
      return b;
    };
    this.muffle = filter('lowpass', RADIO_NEUTRAL.muffleHz);
    this.hp = filter('highpass', RADIO_NEUTRAL.hp);
    this.lp = filter('lowpass', RADIO_NEUTRAL.lp);
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    this.join = ctx.createGain();
    input.connect(this.signal).connect(this.muffle).connect(this.join);
    this.staticGain.connect(this.join);
    this.join.connect(this.hp).connect(this.lp).connect(master);
    // Reroute the music (after the dialogue duck) and the voice bus through the chain.
    music.disconnect();
    music.connect(input);
    voice.disconnect();
    voice.connect(input);
  }

  set(r: RadioParams, staticBuf: AudioBuffer | null, level: number, now: number): void {
    const nyq = this.ctx.sampleRate / 2;
    const tc = Math.max(0.002, r.ramp / 3);
    this.ramp = r.ramp;
    this.signal.gain.setTargetAtTime(r.signal, now, tc);
    this.muffle.frequency.setTargetAtTime(Math.min(r.muffleHz, nyq), now, tc);
    this.hp.frequency.setTargetAtTime(Math.min(r.hp, nyq), now, tc);
    this.lp.frequency.setTargetAtTime(Math.min(r.lp, nyq), now, tc);
    this.staticWant = r.static;
    if (r.static > 0 && staticBuf && (staticBuf !== this.staticBuf || !this.staticSrc)) {
      this.stopStatic(now, 0.05);
      const src = this.ctx.createBufferSource();
      src.buffer = staticBuf;
      src.loop = true;
      src.connect(this.staticGain);
      src.start(now, Math.random() * staticBuf.duration);
      this.staticSrc = src;
      this.staticBuf = staticBuf;
    }
    this.level(level, now);
    if (r.static <= 0) this.stopStatic(now, r.ramp + 0.1);
  }

  /** The static's level × `factor` (the music volume, the pause duck). */
  level(factor: number, now: number): void {
    this.staticGain.gain.setTargetAtTime(this.staticWant * STATIC_LEVEL * factor, now, Math.max(0.002, this.ramp / 3));
  }

  private stopStatic(now: number, after: number): void {
    const src = this.staticSrc;
    this.staticSrc = null;
    this.staticBuf = null;
    if (!src) return;
    try {
      src.stop(now + after);
    } catch {
      // already stopped
    }
    src.onended = (): void => src.disconnect();
  }
}

/** The static's gain at level 1 (white noise is loud; under the speaker filter it reads as hiss). */
const STATIC_LEVEL = 0.35;
