/**
 * Sampled audio manifest (docs/ARCHITECTURE.md §5.7, docs/api/media.md §9.5). Pure data and pure
 * helpers, headless-safe: the loading, decoding and playing live in `samples.browser.ts` and
 * `audio.browser.ts`.
 *
 * A sample is an optional skin over an existing id: a sound effect id (`defineSfx`), a song id
 * (`defineSong`) or a spoken line (keyed by `voiceKey(text)`). The synth stays the fallback:
 * while a sample is missing, loading, failed or not decoded, the synth version plays (sfx and
 * music), the speech announcer or its jingle plays (`voice`), or nothing plays (`say`).
 *
 * Samples come in groups that load together (`AudioOut.loadSamples(group)`):
 * - `'boot'`: the start screens and the UI (title, select and briefing music, menu sounds,
 *   character-select lines), loaded by the boot scene before the first click;
 * - `'mission:ams'`: mission ams (its music, gameplay sounds and dialogue), loaded on the
 *   mission intro card (`MissionDef.audioGroup`);
 * - `'mode:fps'`: the first-person mode after the ams boss (its `fps/*` sounds, songs and voice
 *   lines), loaded by `loadFpsContent` behind the FpsIntroScene / bridge progress bar, never at
 *   boot (docs/design/fps.md §1.5, §9).
 *
 * File paths are relative to `public/audio/` (e.g. `'ams/sfx/ams-bell-1.mp3'`). The data is
 * written by the audio tool into `src/game/content/samples/manifest.ts`.
 */

/** Sampled takes of one sound effect id. */
export interface SampleSfx {
  /** One file per take; a play picks a random take (never the same one twice in a row). */
  files: readonly string[];
  /** Level match against the synth version (gain multiplier, default 1). */
  vol?: number;
  /** Voice limit of this id (default: the synth recipe's). */
  voices?: number;
  /** Minimum seconds between starts of this id (default: the synth recipe's). */
  gap?: number;
  /** Loop points in seconds for `sfxLoop` (default: the whole file). */
  loopStart?: number;
  loopEnd?: number;
}

/** A sampled song (one file: an optional intro, then a loop between the loop points). */
export interface SampleSong {
  file: string;
  /** Gain multiplier (default 1). */
  vol?: number;
  /** Seconds where the loop starts (the end of the intro); null = play once (a jingle). */
  loopStart: number | null;
  /** Seconds where the loop ends (default: `duration`). Never loop on the raw file end (MP3 padding). */
  loopEnd?: number;
  /** Length of the file in seconds (written by the tool). */
  duration: number;
  /** Seconds per order index for `MusicOpts.from` (default: `from` starts at 0). */
  marks?: readonly number[];
}

/** Sampled takes of one spoken line. */
export interface SampleVoice {
  files: readonly string[];
  /** Gain multiplier (default 1). */
  vol?: number;
  /** Length of the longest take in seconds (written by the tool). */
  duration: number;
}

export interface SampleGroup {
  /** By sound effect id. */
  sfx?: Record<string, SampleSfx>;
  /** By song id. */
  music?: Record<string, SampleSong>;
  /** By `voiceKey(text)`. */
  voice?: Record<string, SampleVoice>;
}

/** The sample groups of the game. */
export const SAMPLE_GROUPS = ['boot', 'mission:ams', 'mode:fps'] as const;

const groups = new Map<string, SampleGroup>();

/** Register (or replace) a sample group. */
export function defineSampleGroup(name: string, g: SampleGroup): void {
  groups.set(name, g);
}

export function getSampleGroup(name: string): SampleGroup | undefined {
  return groups.get(name);
}

export function listSampleGroups(): string[] {
  return [...groups.keys()].sort();
}

/** Longest voice key. */
export const VOICE_KEY_MAX = 64;

/**
 * The manifest key of a spoken line: a lower-case slug of the text. Newlines count as spaces, a
 * leading speaker prefix (`'GRAMPS: '`) is dropped, accents are folded, apostrophes and other
 * punctuation are dropped, words are joined by '-', and the key is cut to 64 characters.
 *
 * `'HOI! WELKOM BIJ\nFABEL FRIET!'` → `'hoi-welkom-bij-fabel-friet'`.
 */
export function voiceKey(text: string): string {
  let s = text.replace(/\s+/g, ' ').trim();
  // A speaker prefix: one or two words, then a colon and a space ('GRAMPS: ', 'DJ BEN: ').
  s = s.replace(/^[\p{L}\p{N}][\p{L}\p{N}.'-]*(?: [\p{L}\p{N}][\p{L}\p{N}.'-]*)?: +/u, '');
  s = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > VOICE_KEY_MAX) s = s.slice(0, VOICE_KEY_MAX).replace(/-+$/, '');
  return s;
}

/**
 * The take to play out of `n`, never `last` again when there is a choice. `r` is a random
 * number in [0, 1) (the browser output passes Math.random; never the simulation rng).
 */
export function pickTake(n: number, last: number, r: number): number {
  if (n <= 1) return 0;
  const u = Math.min(0.999999, Math.max(0, r));
  if (last < 0 || last >= n) return Math.floor(u * n);
  const i = Math.floor(u * (n - 1));
  return i >= last ? i + 1 : i;
}

/**
 * The file position (seconds) of a song after `pos` seconds of play: the intro plays once, then
 * the loop between `loopStart` and `loopEnd` repeats. A song without a loop (`loopStart` null)
 * stops at `duration`. Used to resume a paused sample and to start at `MusicOpts.from`.
 */
export function foldLoopPosition(pos: number, loopStart: number | null, loopEnd: number, duration: number): number {
  const p = Math.max(0, pos);
  if (loopStart === null) return Math.min(p, duration);
  const len = loopEnd - loopStart;
  if (p < loopEnd || !(len > 0)) return Math.min(p, loopEnd);
  return loopStart + ((p - loopStart) % len);
}

/** The loop end of a song sample (its `loopEnd`, else the file length). */
export function songLoopEnd(s: SampleSong): number {
  return s.loopEnd ?? s.duration;
}

// ------------------------------------------------------------------ speech lane

/** Announcer lines (`voice`) or speech bubble lines (`say`). */
export type SpeechKind = 'announce' | 'bubble';

export interface SpeechItem {
  key: string;
  kind: SpeechKind;
  /** Request time (seconds, the audio clock). */
  at: number;
  /** Who speaks (bubble lines; informational for announcer lines). */
  speaker?: string;
  /** A bubble line that matters for play (a hint or radio line): a gag line never cuts it off. */
  important?: boolean;
}

/** How a bubble line enters the speech lane (`AudioOut.say`). */
export interface SayOpts {
  /** A hint or radio line (it may cut off a gag line; a gag line never cuts it off). */
  important?: boolean;
}

/** What the output does with a new line. */
export type SpeechAction = 'play' | 'replace' | 'queue' | 'drop';

/** A waiting bubble line is dropped after this many seconds (its bubble has moved on). */
export const BUBBLE_MAX_WAIT = 1.5;
/** A waiting announcer line is dropped after this many seconds. */
export const ANNOUNCE_MAX_WAIT = 3;
/** The same line is not started again this soon after it ended (a bubble set every tick). */
export const SPEECH_REPEAT_GAP = 1;

/**
 * The one speech channel of the sampled voices (pure; the Web Audio output drives it with its
 * clock). Only one line plays at a time:
 *
 * - The same line while it plays or waits (or within SPEECH_REPEAT_GAP s after it ended) is
 *   ignored, so a bubble refreshed every tick speaks once.
 * - A bubble line replaces a playing bubble line at once ('replace') when the same speaker says
 *   it (the speaker's new bubble replaces the old one on screen), or when it is important and the
 *   playing line is not (a hint or radio line cuts off a gag bark). A gag bark never cuts off
 *   another speaker's line, and nothing cuts off an announcer line.
 * - Otherwise a new line waits in a queue of one: the newest waiting line wins, except that a
 *   bubble line never pushes out a waiting announcer line, and a gag line never pushes out a
 *   waiting important line. A waiting line is dropped when it has waited too long
 *   (BUBBLE_MAX_WAIT / ANNOUNCE_MAX_WAIT).
 */
export class SpeechLane {
  playing: SpeechItem | null = null;
  queued: SpeechItem | null = null;
  private readonly ended = new Map<string, number>();

  /** Offer a new line at time `now`; the caller plays it on 'play' / 'replace'. */
  offer(key: string, kind: SpeechKind, now: number, o: { speaker?: string; important?: boolean } = {}): SpeechAction {
    if (this.playing?.key === key || this.queued?.key === key) return 'drop';
    const end = this.ended.get(key);
    if (end !== undefined && now - end < SPEECH_REPEAT_GAP) return 'drop';
    const item: SpeechItem = { key, kind, at: now };
    if (o.speaker !== undefined) item.speaker = o.speaker;
    if (o.important) item.important = true;
    const cur = this.playing;
    if (!cur) {
      this.playing = item;
      return 'play';
    }
    if (kind === 'bubble' && cur.kind === 'bubble') {
      const sameSpeaker = item.speaker !== undefined && item.speaker === cur.speaker;
      if (sameSpeaker || (item.important && !cur.important)) {
        this.ended.set(cur.key, now);
        this.playing = item;
        return 'replace';
      }
    }
    const q = this.queued;
    if (kind === 'bubble' && q && (q.kind === 'announce' || (q.important && !item.important))) return 'drop';
    this.queued = item;
    return 'queue';
  }

  /** The playing line ended at `now`: returns the waiting line to play next, if any. */
  done(now: number): SpeechItem | null {
    if (this.playing) this.ended.set(this.playing.key, now);
    this.playing = null;
    const q = this.queued;
    this.queued = null;
    if (!q) return null;
    const maxWait = q.kind === 'bubble' ? BUBBLE_MAX_WAIT : ANNOUNCE_MAX_WAIT;
    if (now - q.at > maxWait) return null;
    this.playing = q;
    return q;
  }

  /** Forget everything (stopAll). */
  clear(): void {
    this.playing = null;
    this.queued = null;
    this.ended.clear();
  }
}
