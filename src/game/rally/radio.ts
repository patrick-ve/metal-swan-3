/**
 * FILE FM's director: the car radio of mission rally, BINNEN DE RING (docs/design/rally.md §8, §12.6;
 * docs/api/rally.md "C.R The radio"). It listens to the race (the runner's events and a few looks at
 * the race state), picks the DJ's lines from the lines table (content/rally/radio/lines.ts), lets the
 * scheduler (engine/radio.ts) order them, and plays the result: the songs on the music bus (played
 * once, streamed when a take is shipped, else the synth fallbacks of content/music/rally.ts), FREEK
 * FLITS through `say()` (the voice bus ducks the song), the tunnel static through `setRadio()`. The
 * scene copies `ticker` to the HUD (the radio slot: FILE FM and the song title, or the DJ's line).
 *
 * - COSMETIC ONLY: it reads the runner, never writes it; its picks use a fork of `runner.fxRng`
 *   (forking does not advance the parent), never `runner.rng`. A sim runs it with SimAudio (no-ops)
 *   and stays byte-identical.
 * - One radio for both players in 2P: the news of either player's car; the static while a player is
 *   in a tunnel (half static with one of two inside, the full static and no DJ with both).
 * - The race's moments: the fly-over (intro 1), the countdown (the start, timed to the gantry: the
 *   game's countdown stays the master), GO (intro 2, then 3), the leading player's lap (the lap's
 *   song after a jingle, a lap line), the HUD clock (the time lines, a few minutes after each lap's
 *   clock so they do not pile onto the lap call), a new leader (held for 1.5 s), the tunnels (the line
 *   just before the portal; the static cuts it), the cameras, the zone, a red X, the works, the
 *   spitsstrook, a jam, the police (their arrival; blue lights in a player's mirror), a pull-over and
 *   the release, the finish (a rival wins: 'any'; a player wins: 'win'; the results without a win:
 *   'lose'). Between songs: a jingle and a station id or a filler line.
 * - The DJ teases the situation, never a player's skill (the lines table); the heroes say nothing.
 * - Settings: the music volume 0 switches the radio off (no DJ, no ticker; the music bus is silent
 *   anyway); a mute silences the output as a whole.
 *
 * ```ts
 * const radio = new RallyRadio({ audio: app.audio, runner, on: () => app.settings.musicVolume > 0 });
 * radio.step('intro'); // every scene update; then the race's phase
 * scene.ticker = radio.ticker;
 * radio.dispose();
 * ```
 */
import { hasSfx, type AudioOut, type RadioOpts } from '../../engine/audio';
import { RadioScheduler, type RadioCue, type RadioEvent, type RadioRequest } from '../../engine/radio';
import type { Rng } from '../../engine/rng';
import {
  DJ_SPEAKER,
  leaderLine,
  RADIO_CATEGORIES,
  RADIO_JINGLES,
  RADIO_LINES,
  RADIO_SLOGAN,
  RADIO_SONGS,
  RADIO_STATION,
  radioLine,
  tickerText,
  type RadioCategory,
  type RadioLine,
} from '../content/rally/radio/lines';
import type { CarState, RallyBody } from './api';
import { CLOCK_PER_LAP, CLOCK_START, raceProgress } from './daylight';
import { BODY_LIGHT } from './ids';
import { rulesOf } from './rules/rules';
import type { RallyRunner } from './runner';

/** Where the race is: the scene's fold and fly-over ('intro'), then the race's phases. */
export type RadioStage = 'intro' | 'grid' | 'race' | 'finish' | 'done';

/** The director's tuning (ticks at 60 Hz unless named otherwise). */
export const RADIO_DIRECTOR = {
  /** The chance that an AI car's camera flash or red X makes the news (a player's always may). */
  aiNews: 0.25,
  /** No leader news in the first seconds after GO (the grid order is no news). */
  leaderFrom: 600,
  /** A new leader holds the lead this long before the DJ names it. */
  leaderHold: 90,
  /** A time line plays when the HUD clock is this many minutes past its clock (after the lap call)… */
  timeLag: 6,
  /** …and is skipped when the clock is this far past (a late start). */
  timeWindow: 14,
  /**
   * The tunnel line starts its own length before the portal (at the car's speed; at least `tunnelMin`
   * m), so the static cuts its last word: the length at the takes' pace (`tunnelCps` characters per
   * second; the shipped takes run 15–18) less `tunnelEarly` seconds.
   */
  tunnelCps: 16,
  tunnelEarly: 0.15,
  tunnelMin: 40,
  /** Blue lights this close behind a player (m) are "in the mirror". */
  mirror: 140,
  /** How often the mirror is checked. */
  mirrorEvery: 15,
  /** Intro 2 plays only this soon after GO; intro 3 only after intro 2 and this soon. */
  introAfterGo: 600,
  introLate: 1500,
  /** The DJ's line stays on the ticker this long after it ended. */
  captionTail: 45,
  /** The car speaker colour on the songs (0 flat … 1 a small dash speaker): a hint of the car. */
  speaker: 0.25,
  /** The lap line follows the lap's sting by this much (0: at once, before the lap's other news). */
  lapAfter: 0,
  /** A station id or filler line waits at most this long for its slot after a jingle (else it is skipped). */
  betweenWait: 360,
  /** After this long without a line the DJ fills in (a station id or a filler; their cooldowns apply). */
  idleTalk: 3000,
  /** A tunnel's line on the first pass of the race; on a later pass only with this chance (the static always). */
  tunnelAgain: 0.34,
  /** The release is news only this soon after a pull-over line was on air. */
  releaseAfter: 720,
  /** Density (the lead's 'no chatter wall'): the camera flash and the red X lines leave longer gaps than
   * the lines table's defaults (a racer passes about 9 cameras a race), and a flash line rests 90 s. */
  flashGap: 4500,
  redxGap: 1800,
  flashRest: 5400,
} as const;

/** The scheduler's categories: the lines table's, with the director's density for the flashes. */
const CATEGORIES = {
  ...RADIO_CATEGORIES,
  flash: { ...RADIO_CATEGORIES.flash, gap: RADIO_DIRECTOR.flashGap },
  redx: { ...RADIO_CATEGORIES.redx, gap: RADIO_DIRECTOR.redxGap },
};

/** The radio chain while some of the players are in a tunnel (index: 0 none, 1 some, 2 all). */
const RADIO_CHAIN: readonly RadioOpts[] = [
  { speaker: RADIO_DIRECTOR.speaker, ramp: 0.5 },
  { speaker: RADIO_DIRECTOR.speaker, muffle: 0.55, signal: 0.6, static: 0.35, ramp: 0.15 },
  { speaker: RADIO_DIRECTOR.speaker, muffle: 0.9, signal: 0.06, static: 0.9, ramp: 0.12 },
];

/** The static's sound when the content has one (the card's radio crackle), else the output's own noise. */
const STATIC_ID = 'env/radio-static';

/** The ticker without reception (both players in a tunnel). */
export const TICKER_NO_SIGNAL = `${RADIO_STATION}  - GEEN BEREIK -`;

export interface RallyRadioOpts {
  readonly audio: AudioOut;
  readonly runner: RallyRunner;
  /** The radio is on (the music volume is above 0). Default: always. */
  readonly on?: () => boolean;
  /** A trace sink (tools, tests): one line per radio item. */
  readonly trace?: (line: string) => void;
}

/** The lines by category (built once; a flash line's cooldown is at least `flashRest`; the ids and texts stay). */
const BY_CAT = new Map<RadioCategory, RadioLine[]>();
for (const line of RADIO_LINES) {
  const l = line.category === 'flash' ? { ...line, cooldown: Math.max(line.cooldown, RADIO_DIRECTOR.flashRest) } : line;
  const list = BY_CAT.get(l.category);
  if (list) list.push(l);
  else BY_CAT.set(l.category, [l]);
}
const TIME_LINES = BY_CAT.get('time') ?? [];
/** The length (characters) of each tunnel's line, by the tunnel's name. */
const TUNNEL_TEXT = new Map<string, number>((BY_CAT.get('tunnel') ?? []).map((l) => [l.tunnel ?? '', l.text.length]));
const SONG_TITLE = new Map<string, string>(RADIO_SONGS.map((s) => [s.id, `${RADIO_STATION}  ${s.title}`]));
export const JINGLE_TEXT = `${RADIO_STATION}  ${RADIO_SLOGAN}`;
const NO_LINES: readonly RadioLine[] = [];

export class RallyRadio {
  /** DEBUG (tools: tmp/rally-radio/trace.ts, the console): the trace sink of radios made without one. */
  static traceAll: ((line: string) => void) | null = null;
  /** The HUD's radio slot (the scene copies it to every view). */
  ticker = '';
  readonly sched: RadioScheduler;
  private readonly audio: AudioOut;
  private readonly runner: RallyRunner;
  private readonly on: () => boolean;
  private readonly trace: ((line: string) => void) | null;
  private readonly rng: Rng;
  private readonly rand = (): number => this.rng.next();
  private readonly offs: (() => void)[] = [];
  /** The director's clock (every scene update, also during the fold and the fly-over). */
  private t = 0;
  private stage: RadioStage | null = null;
  private lap = 1;
  /** The line on air is a take (its end comes from `speaking()`). */
  private spoken = false;
  private base = '';
  private caption = '';
  private captionUntil = 0;
  private readonly captions = new Map<string, string>();
  private readonly inTunnel = [false, false];
  private chain = -1;
  private leaderId = '';
  private leaderSince = 0;
  private announced = '';
  private readonly timeDone = new Set<number>();
  private readonly tunnelAsked = new Set<string>();
  private readonly tunnelSaid = new Set<string>();
  /** The director tick a pull-over line went on air (−1: none waiting for its release). */
  private pulledAt = -1;
  private won = false;
  private policeSaid = false;
  private betweenN = 0;
  private goTick = -1;
  /** The director tick the last line went on air (or the DJ was asked to fill in). */
  private lastTalk = 0;

  constructor(o: RallyRadioOpts) {
    this.audio = o.audio;
    this.runner = o.runner;
    this.on = o.on ?? (() => true);
    this.trace = o.trace ?? RallyRadio.traceAll;
    this.rng = o.runner.fxRng.fork('radio');
    // The sung jingles between songs; the instrumental sting at a lap change (the DJ talks over it).
    this.sched = new RadioScheduler({ categories: CATEGORIES, songs: RADIO_SONGS, jingles: RADIO_JINGLES.slice(0, 2), sting: RADIO_JINGLES[2] });
    const ev = o.runner.events;
    this.offs.push(
      ev.on('flash', (e) => {
        // Fixer (wave C review): the zone's flashes go through the AI filter as the cameras' do (the
        // rivals collect about 20 zone fines a race; the one zone line played every lap).
        if (e.kind === 'camera') this.news('flash', e.slot);
        else if (e.kind === 'zone') this.news('zone', e.slot);
      }),
      ev.on('redx', (e) => this.news('redx', e.slot)),
      ev.on('roadworksAhead', () => void this.ask('roadworks')),
      ev.on('spitsstrookOpen', () => void this.ask('spitsstrook')),
      ev.on('jam', () => void this.ask('jam')),
      ev.on('policeActive', () => {
        if (!this.policeSaid) this.policeSaid = this.ask('police', (l) => l.on === 'policeActive') === 'queued';
      }),
      ev.on('pulledOver', () => void this.ask('pulledOver')),
      ev.on('released', () => {
        if (this.pulledAt >= 0 && this.t - this.pulledAt < RADIO_DIRECTOR.releaseAfter) {
          this.pulledAt = -1;
          this.ask('released');
        }
      }),
      ev.on('tunnelIn', (e) => {
        if (e.slot >= 0) this.inTunnel[e.slot === 1 ? 1 : 0] = true;
      }),
      ev.on('tunnelOut', (e) => {
        if (e.slot >= 0) this.inTunnel[e.slot === 1 ? 1 : 0] = false;
      }),
      ev.on('finish', (e) => {
        if (e.place !== 1) return;
        if (e.slot >= 0) {
          this.won = true;
          this.ask('finish', (l) => l.result === 'win');
        } else this.ask('finish', (l) => l.result === 'any');
      }),
    );
    this.offs.push(o.audio.onSongEnd?.((id) => this.sched.songEnded(id)) ?? (() => {}));
  }

  /** One scene update (also during the fold and the fly-over; never while paused). */
  step(stage: RadioStage): void {
    const t = ++this.t;
    if (this.stage === null) this.begin(stage);
    if (stage !== this.stage) this.enter(stage);
    this.stage = stage;
    if (stage === 'race' || stage === 'finish') this.watch(stage);
    const clocked = (this.audio.songState?.() ?? null) !== null;
    const busy = this.spoken ? (this.audio.speaking?.() ?? null) : null;
    const events = this.sched.step(t, { busy, signal: this.signal() < 2, clocked });
    for (let i = 0; i < events.length; i++) this.play(events[i]);
    this.updateChain();
    this.updateTicker();
  }

  /** The race scene leaves: the radio goes quiet and neutral. */
  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.sched.stopMusic();
    this.audio.setRadio?.(null);
    this.audio.music(null);
    this.ticker = '';
  }

  // ---------------------------------------------------------------------------------- the moments

  private begin(stage: RadioStage): void {
    this.lap = Math.max(1, this.runner.startLap);
    // After the glitch (the fold, the fly-over) FILE FM opens with its sting, then the lap's song
    // (integrator, wave C); a start without the fold (a sim, a test) plays the song at once.
    this.sched.startMusic(this.lap, this.t, { sting: stage === 'intro' });
    if (stage === 'intro') this.ask('intro', (l) => l.id === 'rally/dj/intro/1', { after: 15 });
  }

  private enter(stage: RadioStage): void {
    if (stage === 'grid') this.ask('start');
    else if (stage === 'race') {
      this.goTick = this.t;
      this.ask('intro', (l) => l.id === 'rally/dj/intro/2', { maxWait: RADIO_DIRECTOR.introAfterGo });
    } else if (stage === 'finish' && !this.won) this.ask('finish', (l) => l.result === 'lose');
  }

  /** The race state's moments (polled): the lap, the leader, the clock, a tunnel ahead, the mirror. */
  private watch(stage: RadioStage): void {
    const r = this.runner;
    const race = r.race;
    const cars = r.cars;
    let lead = 0;
    for (const c of cars) if (c.slot >= 0) lead = Math.max(lead, Math.min(r.laps, c.lap));
    if (lead > this.lap) {
      this.lap = lead;
      this.sched.setLap(lead, this.t);
      if (stage === 'race') this.ask('lap', (l) => l.lap === lead, { after: RADIO_DIRECTOR.lapAfter });
    }
    if (stage !== 'race') return;
    // A new leader, once it holds the lead.
    const first = race.order[0];
    if (first && first.id !== this.leaderId) {
      this.leaderId = first.id;
      this.leaderSince = this.t;
    }
    if (first && race.raceTick >= RADIO_DIRECTOR.leaderFrom && this.t - this.leaderSince === RADIO_DIRECTOR.leaderHold && first.id !== this.announced) {
      const dj = (first.spec as { readonly dj?: string }).dj;
      const line = (dj ? radioLine(dj) : undefined) ?? leaderLine(first.id);
      if (line && this.sched.request(line, this.t) === 'queued') {
        this.announced = first.id;
        this.log('ask', line);
      }
    }
    // The time (the HUD clock passes a time line's clock).
    const clock = CLOCK_START + CLOCK_PER_LAP * raceProgress(race, r.track.length);
    for (const l of TIME_LINES) {
      const c = l.clock ?? 0;
      if (this.timeDone.has(c) || clock < c + RADIO_DIRECTOR.timeLag) continue;
      if (clock >= c + RADIO_DIRECTOR.timeWindow) {
        this.timeDone.add(c);
        continue;
      }
      const res = this.sched.request(l, this.t);
      if (res === 'queued' || res === 'once') this.timeDone.add(c);
      if (res === 'queued') this.log('ask', l);
    }
    // A tunnel just ahead of a player: the line now, the static at the portal cuts it.
    const tunnels = (r.track as { readonly tunnels?: readonly { readonly name: string; readonly s0: number; readonly s1: number }[] }).tunnels;
    if (tunnels) {
      const L = r.track.length;
      for (const c of cars) {
        if (c.slot < 0 || c.finished || this.inTunnel[c.slot === 1 ? 1 : 0]) continue;
        for (let k = 0; k < tunnels.length; k++) {
          const u = tunnels[k];
          const lead = (TUNNEL_TEXT.get(u.name) ?? 32) / RADIO_DIRECTOR.tunnelCps - RADIO_DIRECTOR.tunnelEarly;
          const reach = Math.max(RADIO_DIRECTOR.tunnelMin, Math.abs(c.speed) * lead);
          const ahead = (((u.s0 - c.s) % L) + L) % L;
          if (ahead <= 0 || ahead > reach) continue;
          const key = `${k}:${c.lap}`;
          if (this.tunnelAsked.has(key)) continue;
          this.tunnelAsked.add(key);
          const again = this.tunnelSaid.has(u.name);
          if (again && this.rand() >= RADIO_DIRECTOR.tunnelAgain) continue;
          if (this.ask('tunnel', (l) => l.tunnel === u.name) === 'queued') this.tunnelSaid.add(u.name);
        }
      }
    }
    // A long quiet: the DJ fills in (the station ids and the fillers take turns).
    if (this.t - this.lastTalk >= RADIO_DIRECTOR.idleTalk && !this.sched.onAir && this.sched.waiting.length === 0 && this.signal() === 0) {
      this.lastTalk = this.t;
      this.between(0);
    }
    // Blue lights in a player's mirror.
    if (this.t % RADIO_DIRECTOR.mirrorEvery === 0 && this.mirror(cars, r.bodies)) this.ask('police', (l) => l.on === 'police:chase');
  }

  /** Is a police car with its blue lights on close behind a racing player? */
  private mirror(cars: readonly CarState[], bodies: readonly RallyBody[]): boolean {
    const rules = rulesOf(this.runner);
    for (const c of cars) {
      if (c.slot < 0 || c.finished) continue;
      // Integrator (wave C): "die zijn voor jou" only when a police car hunts this player (not one
      // passing behind on its way to a rival, not after its stop).
      const cr = rules?.of(c);
      if (cr && (cr.hunted < 0 || cr.stopped)) continue;
      for (let i = cars.length; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.kind !== 'police' || b.hidden || !((b.lights ?? 0) & BODY_LIGHT.blue)) continue;
        const gap = c.dist - b.dist;
        if (gap > 0 && gap < RADIO_DIRECTOR.mirror) return true;
      }
    }
    return false;
  }

  /** An AI car's news makes it only sometimes (a player's always may). */
  private news(cat: RadioCategory, slot: number): void {
    if (slot < 0 && this.rand() >= RADIO_DIRECTOR.aiNews) return;
    this.ask(cat);
  }

  /** Pick a line of a category (optionally filtered) and queue it. Null when no line is free. */
  private ask(cat: RadioCategory, filter?: (l: RadioLine) => boolean, o?: { after?: number; maxWait?: number }): RadioRequest | null {
    const all = BY_CAT.get(cat) ?? NO_LINES;
    const cues = filter ? all.filter(filter) : all;
    const cue = this.sched.pick(cues, this.t, this.rand) as RadioLine | null;
    if (!cue) return null;
    const res = this.sched.request(cue, this.t, o);
    if (res === 'queued') this.log('ask', cue);
    return res;
  }

  // ------------------------------------------------------------------------------- the output

  private play(e: RadioEvent): void {
    switch (e.type) {
      case 'say': {
        const cue = e.cue as RadioCue;
        this.spoken = false;
        if (this.on() && (this.audio.hasVoice?.(cue.text) ?? false)) {
          this.audio.say?.(cue.text, DJ_SPEAKER, { important: true });
          this.spoken = true;
        }
        let cap = this.captions.get(cue.id);
        if (cap === undefined) {
          cap = tickerText(cue.text);
          this.captions.set(cue.id, cap);
        }
        this.caption = cap;
        this.lastTalk = this.t;
        if (cue.category === 'pulledOver') this.pulledAt = this.t;
        break;
      }
      case 'end':
        this.spoken = false;
        this.captionUntil = this.t + RADIO_DIRECTOR.captionTail;
        if (e.cue?.id === 'rally/dj/intro/2' && this.goTick >= 0 && this.t - this.goTick < RADIO_DIRECTOR.introLate) this.ask('intro', (l) => l.id === 'rally/dj/intro/3');
        break;
      case 'cut':
        this.spoken = false;
        this.captionUntil = 0;
        break;
      case 'song':
        this.audio.music(e.clip!.id, { once: true, restart: true, fadeTicks: 20 });
        this.base = SONG_TITLE.get(e.clip!.id) ?? RADIO_STATION;
        break;
      case 'jingle':
        this.audio.music(e.clip!.id, { once: true, restart: true, fadeTicks: 10 });
        this.base = JINGLE_TEXT;
        break;
      case 'between': {
        // A station id or a filler line over the jingle's tail (its length from the output when it knows); none after the race.
        if (this.stage === 'finish' || this.stage === 'done') break;
        const st = this.audio.songState?.() ?? null;
        const secs = st && st.id === e.clip?.id && st.duration > 0 ? st.duration : (e.clip?.seconds ?? 0);
        this.between(Math.max(0, Math.round(secs * 60) - 40));
        break;
      }
      case 'drop':
        break;
    }
    this.log(e.type, e.cue ?? null, e.clip?.id, e.why);
  }

  /** Queue a station id or a filler line (they take turns; the other when one is resting). */
  private between(after: number): void {
    const cat: RadioCategory = this.betweenN++ % 2 === 0 ? 'station' : 'filler';
    const o = { after, maxWait: RADIO_DIRECTOR.betweenWait };
    if (this.ask(cat, undefined, o) === null) this.ask(cat === 'station' ? 'filler' : 'station', undefined, o);
  }

  /** 0: no player in a tunnel; 1: some; 2: all (no reception). */
  private signal(): number {
    let n = 0;
    let inside = 0;
    for (const c of this.runner.cars) {
      if (c.slot < 0) continue;
      n++;
      if (this.inTunnel[c.slot === 1 ? 1 : 0]) inside++;
    }
    return inside === 0 || n === 0 ? 0 : inside < n ? 1 : 2;
  }

  private updateChain(): void {
    const k = this.signal();
    if (k === this.chain) return;
    const first = this.chain < 0;
    this.chain = k;
    const o = RADIO_CHAIN[k];
    this.audio.setRadio?.(k > 0 && hasSfx(STATIC_ID) ? { ...o, staticId: STATIC_ID } : o);
    if (!first) this.log(k === 0 ? 'signal' : k === 1 ? 'static-1' : 'static');
  }

  private updateTicker(): void {
    if (!this.on()) this.ticker = '';
    else if (this.chain === 2) this.ticker = TICKER_NO_SIGNAL;
    else if (this.sched.onAir || this.t < this.captionUntil) this.ticker = this.caption;
    else this.ticker = this.base;
  }

  private log(what: string, cue: RadioCue | null = null, clip?: string, why?: string): void {
    if (!this.trace) return;
    const race = this.runner.race;
    const s = this.t / 60;
    const mm = Math.floor(s / 60);
    const ss = s - mm * 60;
    const time = `${String(mm).padStart(2, '0')}:${ss.toFixed(1).padStart(4, '0')}`;
    const rt = race.raceTick >= 0 ? `race ${(race.raceTick / 60).toFixed(1).padStart(5)}s` : 'race    -  ';
    const body = cue ? `${cue.id}  "${cue.text}"` : (clip ?? '');
    this.trace(`${time}  ${rt}  L${this.lap}  ${what.toUpperCase().padEnd(7)} ${body}${why ? `  (${why})` : ''}`);
  }
}
