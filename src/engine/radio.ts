/**
 * The car radio's scheduler (docs/design/rally.md §8, §12.6; docs/api/rally.md "C.R The radio"):
 * pure and node-testable, no audio and no game imports. The rally's director
 * (src/game/rally/radio.ts) feeds it the race's moments and plays what it decides; the same
 * scheduler can serve any later radio. Times are ticks (60 Hz) of the caller's clock.
 *
 * Two lanes:
 *
 * - THE MUSIC LANE: a playlist of one song per lap. A song plays ONCE to its end; then a jingle (a
 *   `between` moment: the director may queue a station id or a filler line) and the lap's song
 *   again from the top. A new lap (`setLap`) changes the song at once: a jingle, then that lap's
 *   song (after the `sting`, when there is one). With an output clock (`clocked`) a song ends when the output says so (`songEnded`); without
 *   one (a sim, an output that never started) after its nominal `seconds`.
 * - THE VOICE LANE: DJ lines and news. One voice at a time. A request waits in a priority queue for
 *   at most its category's `maxWait` (stale news is dropped); cooldowns per line (`RADIO_ONCE_COOLDOWN`
 *   = once per race) and a gap per category; never the same line twice in a row; one waiting item per
 *   category. The quiet before a line depends on its priority (`waits`: urgent news follows at once,
 *   news after a short pause, chatter only after a breath), so the DJ never talks wall to wall. A
 *   waiting item cuts the line on air when it outranks it by `preemptMargin` (a finish or a pull-over
 *   beats a filler); a timed item (`timedPriority`, the start's countdown) always does. No reception
 *   (a tunnel, `signal: false`): the line on air is cut and nothing starts until it is back.
 *
 * ```ts
 * const s = new RadioScheduler({ categories, songs, jingles });
 * s.startMusic(1, now);
 * s.request(line, now);
 * for (const e of s.step(now, { busy: audio.speaking(), clocked: audio.songState() !== null })) …
 * ```
 */

/** A cooldown that means: once per race (the lines table's `RADIO_ONCE`). */
export const RADIO_ONCE_COOLDOWN = -1;

/** How a category queues: its priority, the cooldown of its lines, the gap after it and the longest wait (ticks). */
export interface RadioCategoryRule {
  readonly priority: number;
  readonly cooldown: number;
  readonly gap: number;
  readonly maxWait: number;
}

/** One thing the DJ can say (the rally's `RadioLine` has this shape). */
export interface RadioCue {
  readonly id: string;
  readonly category: string;
  readonly text: string;
  readonly priority: number;
  /** Ticks before it may play again; `RADIO_ONCE_COOLDOWN` = once per race. */
  readonly cooldown: number;
}

/** A song or a jingle of the music lane. */
export interface RadioClip {
  readonly id: string;
  /** Its nominal length (the lane's clock without an output clock). */
  readonly seconds: number;
}

export interface RadioSchedulerOpts {
  readonly categories: Readonly<Record<string, RadioCategoryRule>>;
  /** The playlist: `songs[lap − 1]` (a later lap than the list plays the last song). */
  readonly songs: readonly RadioClip[];
  /** The jingles, played in turn between the songs (after a song ended). */
  readonly jingles: readonly RadioClip[];
  /** The short jingle of a lap change (the DJ talks over it); default the next of `jingles`. */
  readonly sting?: RadioClip;
  /**
   * The quiet (ticks) after the last line before a line of a priority may start: the first tier whose
   * `priority` the line reaches (highest first). Default `RADIO_TUNING.waits`.
   */
  readonly waits?: readonly RadioWait[];
  /** A waiting item cuts the line on air when its priority is higher by this much. */
  readonly preemptMargin?: number;
  /** At and above this priority an item is timed: it cuts any line and never waits for a gap. */
  readonly timedPriority?: number;
  /** The most items that wait (a new, higher one drops the lowest). */
  readonly maxQueue?: number;
  /**
   * The airtime cap: while the DJ talked more than `airMax` (0..1) of the last ~`airWindow` ticks (an
   * exponential average), only urgent lines (`urgentPriority` and up) start; the rest wait (or go stale).
   */
  readonly airMax?: number;
  readonly airWindow?: number;
  readonly urgentPriority?: number;
  /** The speech rate of the estimated length of a line without a take (characters per second). */
  readonly charsPerSecond?: number;
}

/** A tier of `RadioSchedulerOpts.waits`: lines of this priority and up wait `wait` ticks after the last line. */
export interface RadioWait {
  readonly priority: number;
  readonly wait: number;
}

/** The scheduler's defaults (ticks at 60 Hz). */
export const RADIO_TUNING = {
  /** Timed lines at once; urgent news (7+) after 0.4 s; news (5+) after 2 s; chatter after 5 s. */
  waits: [
    { priority: 10, wait: 0 },
    { priority: 7, wait: 24 },
    { priority: 5, wait: 120 },
    { priority: -Infinity, wait: 300 },
  ] as readonly RadioWait[],
  preemptMargin: 3,
  timedPriority: 10,
  airMax: 0.35,
  airWindow: 1800,
  urgentPriority: 7,
  maxQueue: 6,
  charsPerSecond: 13,
  /** The shortest estimated line (ticks). */
  minLine: 60,
  /** A take that reports "not speaking" ends the line only after this many ticks (it may start late). */
  settle: 6,
  /** A take that keeps "speaking" ends the line at its estimate × 2 + this (a stuck flag never blocks the radio). */
  stuck: 120,
  /** The rule of a category the opts do not name. */
  fallbackMaxWait: 240,
} as const;

/** Why a request was not queued. */
export type RadioRequest = 'queued' | 'once' | 'cooldown' | 'gap' | 'repeat' | 'busy' | 'full';

export type RadioEventType = 'say' | 'end' | 'cut' | 'drop' | 'song' | 'jingle' | 'between';

/** What changed (`step` returns them in order; the director plays them). */
export interface RadioEvent {
  readonly type: RadioEventType;
  readonly at: number;
  /** say / end / cut / drop: the line. */
  readonly cue?: RadioCue;
  /** song / jingle: the clip. */
  readonly clip?: RadioClip;
  /** drop: 'stale' (waited too long) or 'full' (a higher item took its place); cut: 'preempt' or 'signal'. */
  readonly why?: string;
}

export interface RadioStepInput {
  /** The line's take is playing (`AudioOut.speaking`); null / absent: no take (its length is estimated). */
  readonly busy?: boolean | null;
  /** Reception (false in a tunnel). Default true. */
  readonly signal?: boolean;
  /** The output has a song clock (`AudioOut.songState()` is not null). Default false. */
  readonly clocked?: boolean;
}

interface Waiting {
  readonly cue: RadioCue;
  /** Not before this tick. */
  readonly from: number;
  readonly deadline: number;
  readonly seq: number;
}

interface OnAir {
  readonly cue: RadioCue;
  readonly start: number;
  readonly est: number;
}

export type RadioMusicMode = 'off' | 'song' | 'jingle';

/** The estimated length (ticks) of a line spoken at `cps` characters per second. */
export function lineTicks(text: string, cps: number = RADIO_TUNING.charsPerSecond): number {
  return Math.max(RADIO_TUNING.minLine, Math.round((text.length / Math.max(1, cps)) * 60));
}

export class RadioScheduler {
  private readonly o: RadioSchedulerOpts;
  private readonly waits: readonly RadioWait[];
  private readonly margin: number;
  private readonly timed: number;
  private readonly maxQueue: number;
  private readonly cps: number;
  private readonly airMax: number;
  private readonly airWindow: number;
  private readonly urgent: number;
  /** The talk meter: an exponential sum of the ticks on air (÷ airWindow = the share of airtime). */
  private talk = 0;
  private talkAt = 0;
  private readonly queue: Waiting[] = [];
  private seq = 0;
  private air: OnAir | null = null;
  /** The tick the last line ended (or was cut); far in the past at first. */
  private lastEnd = -1e9;
  private lastId = '';
  private readonly lastStart = new Map<string, number>();
  private readonly catStart = new Map<string, number>();
  private readonly plays = new Map<string, number>();
  private readonly pending: RadioEvent[] = [];
  private readonly events: RadioEvent[] = [];
  // The music lane.
  private mode: RadioMusicMode = 'off';
  private clip: RadioClip | null = null;
  private clipStart = 0;
  private lapNow = 1;
  private jingleN = 0;
  private ended: string | null = null;

  constructor(o: RadioSchedulerOpts) {
    this.o = o;
    this.waits = [...(o.waits ?? RADIO_TUNING.waits)].sort((a, b) => b.priority - a.priority);
    this.margin = o.preemptMargin ?? RADIO_TUNING.preemptMargin;
    this.timed = o.timedPriority ?? RADIO_TUNING.timedPriority;
    this.maxQueue = o.maxQueue ?? RADIO_TUNING.maxQueue;
    this.cps = o.charsPerSecond ?? RADIO_TUNING.charsPerSecond;
    this.airMax = o.airMax ?? RADIO_TUNING.airMax;
    this.airWindow = Math.max(1, o.airWindow ?? RADIO_TUNING.airWindow);
    this.urgent = o.urgentPriority ?? RADIO_TUNING.urgentPriority;
  }

  /** The DJ's share of the airtime over the last ~`airWindow` ticks (0..1). */
  get airtime(): number {
    return this.talk / this.airWindow;
  }

  // ------------------------------------------------------------------------------ the voice lane

  /** The line on air, or null. */
  get onAir(): RadioCue | null {
    return this.air?.cue ?? null;
  }

  /** The tick the line on air started (−1 when none). */
  get onAirSince(): number {
    return this.air?.start ?? -1;
  }

  /** The waiting lines, best first. */
  get waiting(): RadioCue[] {
    return [...this.queue].sort(better).map((w) => w.cue);
  }

  /** The last line that started ('' before the first). */
  get lastLine(): string {
    return this.lastId;
  }

  /** The rule of a category (a missing one: the cue's own priority and cooldown, no gap). */
  rule(cue: RadioCue): RadioCategoryRule {
    return this.o.categories[cue.category] ?? { priority: cue.priority, cooldown: cue.cooldown, gap: 0, maxWait: RADIO_TUNING.fallbackMaxWait };
  }

  /** Could `cue` be queued now? 'queued' when yes (nothing changes), else why not. */
  check(cue: RadioCue, now: number): RadioRequest {
    const last = this.lastStart.get(cue.id);
    if (last !== undefined) {
      if (cue.cooldown === RADIO_ONCE_COOLDOWN) return 'once';
      if (now - last < cue.cooldown) return 'cooldown';
    }
    if (cue.id === this.lastId) return 'repeat';
    const cat = this.catStart.get(cue.category);
    if (cat !== undefined && now - cat < this.rule(cue).gap) return 'gap';
    if (this.air?.cue.category === cue.category) return 'busy';
    for (const w of this.queue) if (w.cue.category === cue.category) return 'busy';
    return 'queued';
  }

  /**
   * Queue a line: it may start at `after` ticks from now and waits at most its category's `maxWait`
   * (or `o.maxWait`) beyond that. The answer says whether it was queued and else why not.
   */
  request(cue: RadioCue, now: number, o: { after?: number; maxWait?: number } = {}): RadioRequest {
    const ok = this.check(cue, now);
    if (ok !== 'queued') return ok;
    if (this.queue.length >= this.maxQueue) {
      let low = 0;
      for (let i = 1; i < this.queue.length; i++) if (better(this.queue[low], this.queue[i]) < 0) low = i;
      if (this.queue[low].cue.priority >= cue.priority) return 'full';
      const [w] = this.queue.splice(low, 1);
      this.pending.push({ type: 'drop', at: now, cue: w.cue, why: 'full' });
    }
    const from = now + Math.max(0, o.after ?? 0);
    this.queue.push({ cue, from, deadline: from + Math.max(0, o.maxWait ?? this.rule(cue).maxWait), seq: this.seq++ });
    return 'queued';
  }

  /**
   * A line among `cues` that could be queued now, picked by `rand` (0 ≤ rand() < 1; the director's
   * cosmetic rng) among the ones played least often (variety): never the line on air or the last one,
   * never one on its cooldown. Null when none.
   */
  pick(cues: readonly RadioCue[], now: number, rand: () => number): RadioCue | null {
    let least = Infinity;
    for (const c of cues) if (this.check(c, now) === 'queued') least = Math.min(least, this.plays.get(c.id) ?? 0);
    if (least === Infinity) return null;
    let n = 0;
    for (const c of cues) if ((this.plays.get(c.id) ?? 0) === least && this.check(c, now) === 'queued') n++;
    let k = Math.min(n - 1, Math.floor(rand() * n));
    for (const c of cues) {
      if ((this.plays.get(c.id) ?? 0) !== least || this.check(c, now) !== 'queued') continue;
      if (k-- === 0) return c;
    }
    return null;
  }

  /** How often a line went on air. */
  playCount(id: string): number {
    return this.plays.get(id) ?? 0;
  }

  /** Forget every waiting line (the race ends; a new radio programme). */
  clearQueue(now: number): void {
    for (const w of this.queue) this.pending.push({ type: 'drop', at: now, cue: w.cue, why: 'clear' });
    this.queue.length = 0;
  }

  // ------------------------------------------------------------------------------ the music lane

  get musicMode(): RadioMusicMode {
    return this.mode;
  }

  /** The song or jingle that plays (null when the lane is off). */
  get playing(): RadioClip | null {
    return this.clip;
  }

  get lap(): number {
    return this.lapNow;
  }

  /** The song of a lap (1 …; a later lap plays the last song). */
  songOf(lap: number): RadioClip {
    const s = this.o.songs;
    return s[Math.max(0, Math.min(s.length - 1, Math.floor(lap) - 1))];
  }

  /**
   * Start the programme at a lap: the `sting` first (`sting`; the station opens, the DJ talks over
   * it), else a jingle first (`jingle`), else the lap's song at once.
   */
  startMusic(lap: number, now: number, o: { jingle?: boolean; sting?: boolean } = {}): void {
    this.lapNow = Math.max(1, Math.floor(lap));
    if (o.sting && this.o.sting) this.playClip(this.o.sting, now, false);
    else if (o.jingle && this.o.jingles.length > 0) this.playJingle(now, false);
    else this.playSong(now);
  }

  /** A new lap (the leading player's): its song at once, after a jingle; nothing when it plays already. */
  setLap(lap: number, now: number): void {
    const l = Math.max(1, Math.floor(lap));
    if (l === this.lapNow) return;
    this.lapNow = l;
    if (this.mode === 'song' && this.clip?.id !== this.songOf(l).id) {
      if (this.o.sting) this.playClip(this.o.sting, now, false);
      else if (this.o.jingles.length > 0) this.playJingle(now, false);
      else this.playSong(now);
    }
  }

  /** The output's song-end event (a song played once, a jingle). */
  songEnded(id: string): void {
    this.ended = id;
  }

  /** Stop the lane (the race scene leaves). */
  stopMusic(): void {
    this.mode = 'off';
    this.clip = null;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const t = this.pending[i].type;
      if (t === 'song' || t === 'jingle' || t === 'between') this.pending.splice(i, 1);
    }
  }

  private playSong(now: number): void {
    const s = this.songOf(this.lapNow);
    this.mode = 'song';
    this.clip = s;
    this.clipStart = now;
    this.ended = null;
    this.pending.push({ type: 'song', at: now, clip: s });
  }

  private playJingle(now: number, between: boolean): void {
    this.playClip(this.o.jingles[this.jingleN++ % this.o.jingles.length], now, between);
  }

  private playClip(j: RadioClip, now: number, between: boolean): void {
    this.mode = 'jingle';
    this.clip = j;
    this.clipStart = now;
    this.ended = null;
    this.pending.push({ type: 'jingle', at: now, clip: j });
    if (between) this.pending.push({ type: 'between', at: now, clip: j });
  }

  // ------------------------------------------------------------------------------------- step

  /** One tick: the music lane, the stale lines, the line on air, a preemption, the next line. */
  step(now: number, input: RadioStepInput = {}): readonly RadioEvent[] {
    const ev = this.events;
    ev.length = 0;
    // The talk meter (per tick since the last step; a line on air adds its ticks).
    const dt = Math.max(0, Math.min(this.airWindow, now - this.talkAt));
    this.talkAt = now;
    const keep = Math.max(0, 1 - 1 / this.airWindow);
    for (let i = 0; i < dt; i++) this.talk = this.talk * keep + (this.air ? 1 : 0);
    // The music lane: a clip ends by the output's event (clocked) or by its nominal length.
    const clip = this.clip;
    if (clip && this.mode !== 'off') {
      const age = now - this.clipStart;
      // With a clock the output's event ends it (a lost event: after three times its nominal length).
      const done = input.clocked ? this.ended === clip.id || age >= Math.round(clip.seconds * 180) : age >= Math.round(clip.seconds * 60);
      if (done) {
        if (this.mode === 'song') this.playJingle(now, true);
        else this.playSong(now);
      }
    }
    this.ended = null;
    for (const e of this.pending) ev.push(e);
    this.pending.length = 0;
    // Stale news is dropped.
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const w = this.queue[i];
      if (now > w.deadline) {
        this.queue.splice(i, 1);
        ev.push({ type: 'drop', at: now, cue: w.cue, why: 'stale' });
      }
    }
    // The line on air ends: its take stopped, or its estimate passed (no take).
    const air = this.air;
    if (air) {
      const age = now - air.start;
      const busy = input.busy;
      const over = busy === true ? age >= air.est * 2 + RADIO_TUNING.stuck : busy === false ? age >= RADIO_TUNING.settle : age >= air.est;
      if (over) {
        this.air = null;
        this.lastEnd = now;
        ev.push({ type: 'end', at: now, cue: air.cue });
      }
    }
    // No reception: the line on air is cut; nothing starts.
    if (input.signal === false) {
      if (this.air) {
        ev.push({ type: 'cut', at: now, cue: this.air.cue, why: 'signal' });
        this.air = null;
        this.lastEnd = now;
      }
      return ev;
    }
    const best = this.best(now);
    if (!best) return ev;
    if (this.air) {
      const p = best.cue.priority;
      if (p >= this.timed || p - this.air.cue.priority >= this.margin) {
        ev.push({ type: 'cut', at: now, cue: this.air.cue, why: 'preempt' });
        this.air = null;
        this.lastEnd = now;
        this.start(best, now, ev);
      }
      return ev;
    }
    if (best.cue.priority < this.urgent && this.airtime > this.airMax) return ev;
    if (now - this.lastEnd >= this.waitOf(best.cue.priority)) this.start(best, now, ev);
    return ev;
  }

  /** The quiet before a line of priority `p` (ticks after the last line ended). */
  waitOf(p: number): number {
    if (p >= this.timed) return 0;
    for (const w of this.waits) if (p >= w.priority) return w.wait;
    return 0;
  }

  /** The best line that may start now (highest priority, then the oldest). */
  private best(now: number): Waiting | null {
    let b: Waiting | null = null;
    for (const w of this.queue) if (w.from <= now && (!b || better(w, b) < 0)) b = w;
    return b;
  }

  private start(w: Waiting, now: number, ev: RadioEvent[]): void {
    this.queue.splice(this.queue.indexOf(w), 1);
    this.air = { cue: w.cue, start: now, est: lineTicks(w.cue.text, this.cps) };
    this.lastId = w.cue.id;
    this.lastStart.set(w.cue.id, now);
    this.plays.set(w.cue.id, (this.plays.get(w.cue.id) ?? 0) + 1);
    this.catStart.set(w.cue.category, now);
    ev.push({ type: 'say', at: now, cue: w.cue });
  }
}

/** Queue order: higher priority first, then the older request. */
function better(a: Waiting, b: Waiting): number {
  return b.cue.priority - a.cue.priority || a.seq - b.seq;
}
