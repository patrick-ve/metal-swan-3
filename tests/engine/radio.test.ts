/**
 * The car radio's scheduler (src/engine/radio.ts; docs/api/rally.md "C.R The radio"): the voice lane
 * (priorities, cooldowns per line and per category, the queue's time-out, preemption, one voice at a
 * time, no line twice in a row, the airtime cap, no reception) and the music lane (one song per lap,
 * a jingle between, the lap's sting, the output's clock or the nominal one).
 */
import { describe, expect, it } from 'vitest';
import { lineTicks, RADIO_ONCE_COOLDOWN, RADIO_TUNING, RadioScheduler, type RadioCategoryRule, type RadioCue, type RadioEvent } from '../../src/engine/radio';

const CATS: Record<string, RadioCategoryRule> = {
  filler: { priority: 1, cooldown: 7200, gap: 2700, maxWait: 1200 },
  time: { priority: 4, cooldown: RADIO_ONCE_COOLDOWN, gap: 1800, maxWait: 1200 },
  flash: { priority: 6, cooldown: 2400, gap: 900, maxWait: 240 },
  jam: { priority: 5, cooldown: 3600, gap: 1800, maxWait: 480 },
  pulledOver: { priority: 7, cooldown: 1800, gap: 1200, maxWait: 240 },
  finish: { priority: 9, cooldown: RADIO_ONCE_COOLDOWN, gap: 0, maxWait: 600 },
  start: { priority: 10, cooldown: RADIO_ONCE_COOLDOWN, gap: 0, maxWait: 60 },
};

function cue(category: string, n: number, text = `${category} line ${n} with some words`): RadioCue {
  const c = CATS[category];
  return { id: `dj/${category}/${n}`, category, text, priority: c.priority, cooldown: c.cooldown };
}

const SONGS = [
  { id: 'lap1', seconds: 10 },
  { id: 'lap2', seconds: 10 },
  { id: 'lap3', seconds: 10 },
];
const JINGLES = [
  { id: 'j1', seconds: 2 },
  { id: 'j2', seconds: 2 },
];

function sched(o: Partial<ConstructorParameters<typeof RadioScheduler>[0]> = {}): RadioScheduler {
  return new RadioScheduler({ categories: CATS, songs: SONGS, jingles: JINGLES, airMax: 1, ...o });
}

/** Step from `from` to `to` (inclusive) and collect every event. */
function run(s: RadioScheduler, from: number, to: number, input: Parameters<RadioScheduler['step']>[1] = {}): RadioEvent[] {
  const out: RadioEvent[] = [];
  for (let t = from; t <= to; t++) out.push(...s.step(t, input));
  return out;
}

const said = (ev: readonly RadioEvent[]): string[] => ev.filter((e) => e.type === 'say').map((e) => e.cue!.id);

describe('the voice lane', () => {
  it('plays the highest priority first, then the older request', () => {
    const s = sched();
    s.request(cue('jam', 1), 0, { maxWait: 2000 });
    s.request(cue('flash', 1), 0, { maxWait: 2000 });
    s.request(cue('pulledOver', 1), 0);
    const ev = run(s, 0, 2000);
    expect(said(ev)).toEqual(['dj/pulledOver/1', 'dj/flash/1', 'dj/jam/1']);
  });

  it('never two voices at once: a line starts only after the one on air ended', () => {
    const s = sched();
    s.request(cue('flash', 1), 0);
    s.request(cue('jam', 1), 0);
    let onAir = 0;
    let most = 0;
    for (let t = 0; t < 2000; t++) {
      for (const e of s.step(t)) {
        if (e.type === 'say') onAir++;
        if (e.type === 'end' || e.type === 'cut') onAir--;
      }
      most = Math.max(most, onAir);
    }
    expect(most).toBe(1);
  });

  it('a line without a take lasts its estimate; a take ends it when it stops speaking', () => {
    const c = cue('flash', 1, 'Flits! Dat wordt een envelop op de mat.');
    const s = sched();
    s.request(c, 0);
    const ev = run(s, 0, 400);
    const end = ev.find((e) => e.type === 'end')!;
    expect(end.at).toBe(lineTicks(c.text));
    const s2 = sched();
    s2.request(c, 0);
    run(s2, 0, 50, { busy: true });
    const ev2 = run(s2, 51, 60, { busy: false });
    expect(ev2.find((e) => e.type === 'end')?.at).toBe(51);
    // A stuck "speaking" flag never blocks the radio.
    const s3 = sched();
    s3.request(c, 0);
    const ev3 = run(s3, 0, 1000, { busy: true });
    expect(ev3.find((e) => e.type === 'end')?.at).toBe(lineTicks(c.text) * 2 + RADIO_TUNING.stuck);
  });

  it('cooldowns: per line (and once per race), per category (the gap)', () => {
    const s = sched();
    expect(s.request(cue('flash', 1), 0)).toBe('queued');
    run(s, 0, 300);
    // The category's gap (900) after the flash line started at 0.
    expect(s.request(cue('flash', 2), 500)).toBe('gap');
    expect(s.request(cue('flash', 2), 900)).toBe('queued');
    run(s, 301, 1400);
    // The line's own cooldown (2400 after it started at 0).
    expect(s.request(cue('flash', 1), 2000)).toBe('cooldown');
    expect(s.request(cue('flash', 1), 2401)).toBe('queued');
    // Once per race.
    const f = cue('finish', 1);
    expect(s.request(f, 3000)).toBe('queued');
    run(s, 2402, 4000);
    expect(s.request(f, 90000)).toBe('once');
  });

  it('one waiting line per category; never the same line twice in a row', () => {
    const s = sched();
    expect(s.request(cue('jam', 1), 0)).toBe('queued');
    expect(s.request(cue('jam', 2), 0)).toBe('busy');
    const short: RadioCue = { ...cue('flash', 9), cooldown: 0 };
    const cats = { ...CATS, flash: { ...CATS.flash, gap: 0 } };
    const s2 = new RadioScheduler({ categories: cats, songs: SONGS, jingles: JINGLES, airMax: 1 });
    s2.request(short, 0);
    run(s2, 0, 400);
    expect(s2.lastLine).toBe('dj/flash/9');
    expect(s2.request(short, 500)).toBe('repeat');
  });

  it('the queue keeps news for its maxWait only (stale news is dropped)', () => {
    const s = sched();
    // A long line on air (priority 7); a flash (maxWait 240) waits behind it and goes stale.
    s.request({ ...cue('pulledOver', 1), text: 'x'.repeat(13 * 8) }, 0);
    run(s, 0, 1);
    s.request(cue('flash', 1), 2);
    const ev = run(s, 2, 600);
    const drop = ev.find((e) => e.type === 'drop');
    expect(drop?.cue?.id).toBe('dj/flash/1');
    expect(drop?.why).toBe('stale');
    expect(drop?.at).toBe(2 + 240 + 1);
    expect(said(ev)).not.toContain('dj/flash/1');
  });

  it('preemption: a finish or a pull-over beats a filler; the timed start beats anything; equals wait', () => {
    const s = sched();
    s.request(cue('filler', 1), 0);
    run(s, 0, 10);
    expect(s.onAir?.id).toBe('dj/filler/1');
    s.request(cue('pulledOver', 1), 11);
    const ev = run(s, 11, 12);
    expect(ev.map((e) => `${e.type}:${e.cue?.id}`)).toEqual(['cut:dj/filler/1', 'say:dj/pulledOver/1']);
    // A flash (6) does not cut a pull-over (7): it waits for the end.
    s.request(cue('flash', 1), 13);
    expect(run(s, 13, 14).filter((e) => e.type === 'cut')).toEqual([]);
    expect(s.onAir?.id).toBe('dj/pulledOver/1');
    // The start (timed) cuts the pull-over at once.
    s.request(cue('start', 1), 15);
    const ev2 = run(s, 15, 15);
    expect(ev2.map((e) => `${e.type}:${e.cue?.id}`)).toEqual(['cut:dj/pulledOver/1', 'say:dj/start/1']);
    // The finish (9) cuts a filler too.
    const s2 = sched();
    s2.request(cue('filler', 2), 0);
    run(s2, 0, 10);
    s2.request(cue('finish', 1), 11);
    expect(said(run(s2, 11, 11))).toEqual(['dj/finish/1']);
  });

  it('the quiet before a line follows its priority (urgent news fast, chatter after a breath)', () => {
    const s = sched();
    expect(s.waitOf(10)).toBe(0);
    expect(s.waitOf(7)).toBe(24);
    expect(s.waitOf(5)).toBe(120);
    expect(s.waitOf(1)).toBe(300);
    s.request(cue('flash', 1), 0);
    const end = run(s, 0, 400).find((e) => e.type === 'end')!.at;
    s.request(cue('filler', 1), end + 1);
    s.request(cue('pulledOver', 1), end + 1);
    const ev = run(s, end + 1, end + 2000);
    const sayAt = (id: string): number => ev.find((e) => e.type === 'say' && e.cue?.id === id)!.at;
    expect(sayAt('dj/pulledOver/1')).toBe(end + 24);
    const end2 = ev.find((e) => e.type === 'end' && e.cue?.id === 'dj/pulledOver/1')!.at;
    expect(sayAt('dj/filler/1')).toBe(end2 + 300);
  });

  it('the airtime cap: after a lot of talk only urgent lines start', () => {
    const s = new RadioScheduler({ categories: CATS, songs: SONGS, jingles: JINGLES, airMax: 0.3, airWindow: 600 });
    s.request({ ...cue('pulledOver', 1), text: 'x'.repeat(13 * 6) }, 0);
    run(s, 0, 360);
    expect(s.airtime).toBeGreaterThan(0.3);
    s.request(cue('flash', 1), 361);
    s.request(cue('finish', 1), 361);
    const cats = run(s, 361, 400);
    // The urgent finish starts; the flash waits.
    expect(said(cats)).toEqual(['dj/finish/1']);
    expect(s.waiting.map((c) => c.id)).toEqual(['dj/flash/1']);
  });

  it('no reception: the line on air is cut, nothing starts until the signal is back', () => {
    const s = sched();
    s.request(cue('flash', 1), 0);
    run(s, 0, 5);
    const ev = run(s, 6, 6, { signal: false });
    expect(ev.map((e) => `${e.type}:${e.why}`)).toEqual(['cut:signal']);
    s.request(cue('pulledOver', 1), 7);
    expect(said(run(s, 7, 100, { signal: false }))).toEqual([]);
    expect(said(run(s, 101, 200))).toEqual(['dj/pulledOver/1']);
  });

  it('pick: a free line, the least played first, never the last one or one on its cooldown', () => {
    const s = sched();
    const lines = [cue('jam', 1), cue('jam', 2), cue('jam', 3)];
    const seen = new Set<string>();
    let r = 0;
    const rand = (): number => ((r = (r * 7 + 3) % 10), r / 10);
    let t = 0;
    for (let i = 0; i < 3; i++) {
      const c = s.pick(lines, t, rand)!;
      expect(seen.has(c.id)).toBe(false);
      seen.add(c.id);
      expect(s.request(c, t)).toBe('queued');
      run(s, t, t + 1900);
      t += 1901;
    }
    expect(seen.size).toBe(3);
    // Every line on its cooldown (3600 after its start): nothing to pick.
    expect(s.pick(lines, t - 1000, rand)).toBeNull();
  });
});

describe('the music lane', () => {
  it('one song per lap: a song, a jingle between (a "between" moment), the lap song again (nominal clock)', () => {
    const s = sched();
    s.startMusic(1, 0);
    const ev = run(s, 0, 1500).filter((e) => e.type === 'song' || e.type === 'jingle' || e.type === 'between');
    expect(ev.map((e) => `${e.type}:${e.clip!.id}@${e.at}`)).toEqual(['song:lap1@0', 'jingle:j1@600', 'between:j1@600', 'song:lap1@720', 'jingle:j2@1320', 'between:j2@1320', 'song:lap1@1440']);
  });

  it('a new lap changes the song at once, after the sting (no "between" moment)', () => {
    const s = sched({ sting: { id: 'sting', seconds: 1 } });
    s.startMusic(1, 0);
    run(s, 0, 100);
    s.setLap(2, 101);
    const ev = run(s, 101, 300).filter((e) => e.type === 'song' || e.type === 'jingle' || e.type === 'between');
    expect(ev.map((e) => `${e.type}:${e.clip!.id}@${e.at}`)).toEqual(['jingle:sting@101', 'song:lap2@161']);
    // A lap past the playlist plays the last song; the same lap does nothing.
    s.setLap(2, 400);
    expect(run(s, 400, 401).filter((e) => e.type === 'song' || e.type === 'jingle')).toEqual([]);
    expect(s.songOf(9).id).toBe('lap3');
  });

  it('the station opens with the sting (startMusic sting), then the lap\'s song (integrator, wave C)', () => {
    const s = sched({ sting: { id: 'sting', seconds: 1 } });
    s.startMusic(1, 0, { sting: true });
    const ev = run(s, 0, 200).filter((e) => e.type === 'song' || e.type === 'jingle' || e.type === 'between');
    expect(ev.map((e) => `${e.type}:${e.clip!.id}@${e.at}`)).toEqual(['jingle:sting@0', 'song:lap1@60']);
    // Without a sting it is the song at once.
    const s2 = sched();
    s2.startMusic(1, 0, { sting: true });
    expect(run(s2, 0, 1).filter((e) => e.type === 'song').map((e) => e.clip!.id)).toEqual(['lap1']);
  });

  it('with an output clock a song ends by the output event (or after 3× its length when the event is lost)', () => {
    const s = sched();
    s.startMusic(1, 0);
    run(s, 0, 0, { clocked: true });
    expect(run(s, 1, 900, { clocked: true }).filter((e) => e.type === 'jingle')).toEqual([]);
    s.songEnded('lap1');
    const ev = run(s, 901, 901, { clocked: true });
    expect(ev.map((e) => e.type)).toEqual(['jingle', 'between']);
    s.songEnded('j1');
    expect(run(s, 902, 902, { clocked: true }).map((e) => `${e.type}:${e.clip?.id}`)).toEqual(['song:lap1']);
    // The event never comes: the lane moves on after three times the nominal length.
    const lost = run(s, 903, 902 + 1800, { clocked: true }).filter((e) => e.type === 'jingle');
    expect(lost.map((e) => e.at)).toEqual([902 + 1800]);
  });

  it('stopMusic stops the lane', () => {
    const s = sched();
    s.startMusic(2, 0);
    expect(s.playing?.id).toBe('lap2');
    s.stopMusic();
    expect(run(s, 1, 2000).filter((e) => e.type === 'song' || e.type === 'jingle')).toEqual([]);
    expect(s.musicMode).toBe('off');
  });
});
