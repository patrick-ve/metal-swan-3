import type { AudioOut, MusicOpts, SfxOpts, VolumeKind } from './audio';
import type { InstrumentDef, InstrumentEnv, ParsedSong, ScheduledNote } from './music';
import { getSong, midiToFreq, orderTime, songError, songEvents, songLength } from './music';
import { jitterPitch, renderSfx, SAMPLE_RATE, sfxJitter, sfxLimits } from './synth';
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
}

interface ActiveSfx {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
  end: number;
}

const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);

export class WebAudioOut implements AudioOut {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<'music' | 'sfx' | 'voice', GainNode> | null = null;
  private readonly vols: Record<VolumeKind, number> = { master: 0.8, music: 0.6, sfx: 0.8, voice: 1 };
  private muted = false;
  private readonly buffers = new Map<string, AudioBuffer | null>();
  private active: ActiveSfx[] = [];
  private readonly lastStart = new Map<string, number>();
  private song: SongPlayer | null = null;
  private wanted: { id: string | null; opts?: MusicOpts } | null = null;
  /** Looping sounds by key (sfxLoop / stopSfx). */
  private readonly loops = new Map<string, { id: string; src: AudioBufferSourceNode; gain: GainNode }>();
  private duck = 1;
  private readonly announcer: Announcer;
  private readonly useSpeech: boolean;
  private readonly maxVoices: number;
  private readonly warned = new Set<string>();

  constructor(opts: WebAudioOpts = {}) {
    this.maxVoices = Math.max(1, opts.maxVoices ?? 24);
    this.useSpeech = opts.speech !== false;
    this.announcer = createAnnouncer();
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
    this.buses = { music: bus(), sfx: bus(), voice: bus() };
    this.applyVolumes(true);
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
    const buf = this.buffer(id);
    if (!buf) return;
    const now = ctx.currentTime;
    const lim = sfxLimits(id);
    const last = this.lastStart.get(id);
    if (last !== undefined && now - last < lim.gap) return;
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
    gain.gain.value = clamp01(o?.vol ?? 1);
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
    this.song = new SongPlayer(ctx, id, parsed, this.buses.music, (sfxId) => this.buffer(sfxId));
    this.song.start(fade, o?.from ? orderTime(parsed, o.from) : 0);
  }

  /** Id of the song that is loaded (playing or paused), or null. */
  get currentSong(): string | null {
    return this.song?.id ?? null;
  }

  // ------------------------------------------------------------------ loops & ducking

  sfxLoop(key: string, id: string, o?: SfxOpts): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses || ctx.state !== 'running') return;
    const cur = this.loops.get(key);
    const vol = clamp01(o?.vol ?? 1);
    const pitch = Math.max(0.1, Math.min(4, o?.pitch ?? 1));
    if (cur && cur.id === id) {
      cur.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
      cur.src.playbackRate.setTargetAtTime(pitch, ctx.currentTime, 0.02);
      return;
    }
    if (cur) this.stopSfx(key);
    const buf = this.buffer(id);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = pitch;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(this.buses.sfx);
    src.start();
    this.loops.set(key, { id, src, gain });
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

  pauseMusic(): void {
    this.song?.pause();
  }

  resumeMusic(): void {
    this.song?.resume();
  }

  // ------------------------------------------------------------------ voice, volume, control

  voice(line: string): void {
    this.announcer.volume = this.muted ? 0 : this.vols.master * this.vols.voice;
    if (this.useSpeech && !this.muted && this.announcer.say(line)) return;
    const ctx = this.ctx;
    if (ctx && this.buses && ctx.state === 'running') this.play('ui/announce', this.buses.voice);
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
  }

  stopAll(): void {
    const ctx = this.ctx;
    this.announcer.cancel();
    this.wanted = null;
    if (!ctx) return;
    const now = ctx.currentTime;
    while (this.active.length > 0) this.kill(this.active.length - 1, now);
    for (const key of [...this.loops.keys()]) this.stopSfx(key, 0);
    this.song?.stop(0);
    this.song = null;
  }

  suspend(): void {
    void this.ctx?.suspend().catch(() => undefined);
  }

  resume(): void {
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

class SongPlayer {
  readonly id: string;
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

  constructor(ctx: BaseAudioContext, id: string, song: ParsedSong, bus: GainNode, drum: (id: string) => AudioBuffer | null) {
    this.ctx = ctx;
    this.id = id;
    this.song = song;
    this.drum = drum;
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
    const until = this.ctx.currentTime - this.startAt + HORIZON;
    if (until <= this.cursor) return;
    this.events.length = 0;
    songEvents(this.song, this.cursor, until, this.events);
    for (const ev of this.events) this.note(ev);
    this.cursor = until;
    if (this.song.loopRow === null && this.cursor > songLength(this.song) + 3) this.stop(0);
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
